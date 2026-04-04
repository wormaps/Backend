import {
  estimateFacadeEdgeIndex,
  resolveBuildingStyle,
} from './scene-building-style.utils';

describe('scene-building-style utils', () => {
  it('classifies a glass commercial tower as glass_tower with stepped fallback roof', () => {
    const style = resolveBuildingStyle({
      usage: 'COMMERCIAL',
      heightMeters: 72,
      facadeMaterial: 'glass',
      roofMaterial: 'metal',
      roofShape: null,
      facadeColor: null,
      roofColor: null,
      buildingPart: null,
      outerRing: [
        { lat: 35.6597, lng: 139.7007 },
        { lat: 35.6597, lng: 139.7009 },
        { lat: 35.6595, lng: 139.7009 },
        { lat: 35.6595, lng: 139.7007 },
      ],
    });

    expect(style.preset).toBe('glass_tower');
    expect(style.roofType).toBe('stepped');
    expect(style.materialClass).toBe('glass');
    expect(style.billboardEligible).toBe(true);
  });

  it('respects explicit roof shape and picks longest facade edge', () => {
    const style = resolveBuildingStyle({
      usage: 'MIXED',
      heightMeters: 10,
      facadeMaterial: 'brick',
      roofMaterial: 'tile',
      roofShape: 'gable',
      facadeColor: null,
      roofColor: null,
      buildingPart: null,
      outerRing: [
        { lat: 37.1, lng: 127.1 },
        { lat: 37.1, lng: 127.1006 },
        { lat: 37.1002, lng: 127.1006 },
        { lat: 37.1002, lng: 127.1 },
      ],
    });

    expect(style.roofType).toBe('gable');
    expect(style.preset).toBe('small_lowrise');
    expect(estimateFacadeEdgeIndex([
      { lat: 37.1, lng: 127.1 },
      { lat: 37.1, lng: 127.1006 },
      { lat: 37.1002, lng: 127.1006 },
      { lat: 37.1002, lng: 127.1 },
    ])).toBe(0);
  });
});
