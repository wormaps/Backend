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
    expect(
      estimateFacadeEdgeIndex([
        { lat: 37.1, lng: 127.1 },
        { lat: 37.1, lng: 127.1006 },
        { lat: 37.1002, lng: 127.1006 },
        { lat: 37.1002, lng: 127.1 },
      ]),
    ).toBe(0);
  });

  it('avoids over-classifying non-commercial low-midrise as commercial_midrise', () => {
    const style = resolveBuildingStyle({
      usage: 'MIXED',
      heightMeters: 16,
      facadeMaterial: null,
      roofMaterial: null,
      roofShape: null,
      facadeColor: null,
      roofColor: null,
      buildingPart: null,
      outerRing: [
        { lat: 35.6597, lng: 139.7002 },
        { lat: 35.6597, lng: 139.70034 },
        { lat: 35.65956, lng: 139.70034 },
        { lat: 35.65956, lng: 139.7002 },
      ],
    });

    expect(style.visualArchetype).toBe('apartment_block');
    expect(style.facadePreset).toBe('concrete_repetitive');
  });

  it('uses deterministic non-random material class for small_lowrise', () => {
    const styleA = resolveBuildingStyle({
      usage: 'MIXED',
      heightMeters: 10,
      facadeMaterial: null,
      roofMaterial: null,
      roofShape: null,
      facadeColor: null,
      roofColor: null,
      buildingPart: null,
      outerRing: [
        { lat: 35.7, lng: 139.7 },
        { lat: 35.7, lng: 139.7001 },
        { lat: 35.6999, lng: 139.7001 },
        { lat: 35.6999, lng: 139.7 },
      ],
    });
    const styleB = resolveBuildingStyle({
      usage: 'MIXED',
      heightMeters: 10,
      facadeMaterial: null,
      roofMaterial: null,
      roofShape: null,
      facadeColor: null,
      roofColor: null,
      buildingPart: null,
      outerRing: [
        { lat: 35.71, lng: 139.71 },
        { lat: 35.71, lng: 139.7101 },
        { lat: 35.7099, lng: 139.7101 },
        { lat: 35.7099, lng: 139.71 },
      ],
    });

    expect(styleA.preset).toBe('small_lowrise');
    expect(styleB.preset).toBe('small_lowrise');
    expect(styleA.materialClass).toBe('brick');
    expect(styleB.materialClass).toBe('brick');
  });
});
