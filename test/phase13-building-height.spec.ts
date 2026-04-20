import { describe, expect, it } from 'bun:test';
import {
  computeContextMedian,
  estimateBuildingHeight,
  JAPANESE_FLOOR_HEIGHT_METERS,
} from '../src/places/domain/building-height.estimator';

describe('BuildingHeight Domain', () => {
  it('returns EXACT confidence when height tag is present', () => {
    const result = estimateBuildingHeight({ height: '45' });
    expect(result.heightMeters).toBe(45);
    expect(result.confidence).toBe('EXACT');
  });

  it('returns LEVELS_BASED confidence with 3.5m per floor', () => {
    const result = estimateBuildingHeight({ 'building:levels': '10' });
    expect(result.heightMeters).toBe(35);
    expect(result.confidence).toBe('LEVELS_BASED');
  });

  it('uses 3.5m floor height (not 3.2m)', () => {
    const result = estimateBuildingHeight({ 'building:levels': '1' });
    expect(result.heightMeters).toBe(JAPANESE_FLOOR_HEIGHT_METERS);
    expect(result.heightMeters).toBe(3.5);
  });

  it('returns CONTEXT_MEDIAN when no tags but context median provided', () => {
    const result = estimateBuildingHeight({}, 20);
    expect(result.heightMeters).toBe(20);
    expect(result.confidence).toBe('CONTEXT_MEDIAN');
  });

  it('returns TYPE_DEFAULT for building=commercial with no context', () => {
    const result = estimateBuildingHeight({ building: 'commercial' });
    expect(result.heightMeters).toBe(12);
    expect(result.confidence).toBe('TYPE_DEFAULT');
  });

  it('returns TYPE_DEFAULT for building=residential with no context', () => {
    const result = estimateBuildingHeight({ building: 'residential' });
    expect(result.heightMeters).toBe(9);
    expect(result.confidence).toBe('TYPE_DEFAULT');
  });

  it('returns TYPE_DEFAULT for building=house with no context', () => {
    const result = estimateBuildingHeight({ building: 'house' });
    expect(result.heightMeters).toBe(5);
    expect(result.confidence).toBe('TYPE_DEFAULT');
  });

  it('returns TYPE_DEFAULT for building=skyscraper with no context', () => {
    const result = estimateBuildingHeight({ building: 'skyscraper' });
    expect(result.heightMeters).toBe(80);
    expect(result.confidence).toBe('TYPE_DEFAULT');
  });

  it('falls back to commercial default when no tags and no context', () => {
    const result = estimateBuildingHeight({});
    expect(result.heightMeters).toBe(12);
    expect(result.confidence).toBe('TYPE_DEFAULT');
  });

  it('prioritizes height tag over building:levels', () => {
    const result = estimateBuildingHeight({
      height: '50',
      'building:levels': '10',
    });
    expect(result.heightMeters).toBe(50);
    expect(result.confidence).toBe('EXACT');
  });

  it('prioritizes building:levels over context median', () => {
    const result = estimateBuildingHeight({ 'building:levels': '5' }, 100);
    expect(result.heightMeters).toBe(17.5);
    expect(result.confidence).toBe('LEVELS_BASED');
  });

  it('rejects invalid height values', () => {
    const result = estimateBuildingHeight({ height: 'abc' });
    expect(result.heightMeters).toBe(12);
    expect(result.confidence).toBe('TYPE_DEFAULT');
  });

  it('rejects negative height values', () => {
    const result = estimateBuildingHeight({ height: '-5' });
    expect(result.heightMeters).toBe(12);
    expect(result.confidence).toBe('TYPE_DEFAULT');
  });

  it('rejects zero building:levels', () => {
    const result = estimateBuildingHeight({ 'building:levels': '0' });
    expect(result.heightMeters).toBe(12);
    expect(result.confidence).toBe('TYPE_DEFAULT');
  });
});

describe('Context Median', () => {
  it('computes median from height tags', () => {
    const buildings = [
      { tags: { height: '10' } },
      { tags: { height: '20' } },
      { tags: { height: '30' } },
    ];
    const median = computeContextMedian(buildings);
    expect(median).toBe(20);
  });

  it('computes median from building:levels tags', () => {
    const buildings = [
      { tags: { 'building:levels': '2' } },
      { tags: { 'building:levels': '4' } },
      { tags: { 'building:levels': '6' } },
    ];
    const median = computeContextMedian(buildings);
    expect(median).toBe(14);
  });

  it('filters by building type when provided', () => {
    const buildings = [
      { tags: { building: 'commercial', height: '10' } },
      { tags: { building: 'commercial', height: '20' } },
      { tags: { building: 'residential', height: '100' } },
    ];
    const median = computeContextMedian(buildings, 'commercial');
    expect(median).toBe(15);
  });

  it('returns undefined when no valid heights', () => {
    const buildings = [
      { tags: {} as Record<string, string> },
      { tags: { building: 'house' } },
    ];
    const median = computeContextMedian(buildings);
    expect(median).toBeUndefined();
  });

  it('returns single value when only one building', () => {
    const buildings = [{ tags: { height: '25' } }];
    const median = computeContextMedian(buildings);
    expect(median).toBe(25);
  });

  it('computes even-length median correctly', () => {
    const buildings = [
      { tags: { height: '10' } },
      { tags: { height: '20' } },
      { tags: { height: '30' } },
      { tags: { height: '40' } },
    ];
    const median = computeContextMedian(buildings);
    expect(median).toBe(25);
  });
});
