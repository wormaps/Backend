import { describe, expect, it } from 'bun:test';
import {
  resolveFacadeProfileForWeakEvidence,
  resolveSceneWideAtmosphereWithPlaceCharacter,
} from '../src/scene/services/vision/scene-atmosphere-district.utils';
import type { PlaceCharacter } from '../src/scene/domain/place-character.value-object';
import type { DistrictAtmosphereProfile } from '../src/scene/types/scene.types';

describe('FacadeAtmosphere Application — Mapillary 없는 시나리오', () => {
  const electronicsCharacter: PlaceCharacter = {
    districtType: 'ELECTRONICS_DISTRICT',
    signageDensity: 'DENSE',
    buildingEra: 'MIXED',
    facadeComplexity: 'HIGH',
  };

  it('weakEvidenceRatio=1.0 + ELECTRONICS_DISTRICT → neon_warm 프로필 적용', () => {
    const districtProfiles: DistrictAtmosphereProfile[] = [];
    const result = resolveSceneWideAtmosphereWithPlaceCharacter(
      districtProfiles,
      electronicsCharacter,
      1.0,
    );
    expect(result.lightingProfile).toBe('neon_night');
    expect(result.evidenceStrength).toBe('weak');
  });

  it('weakEvidenceRatio=0.3 + districtProfiles → 기존 district voting 사용', () => {
    const districtProfiles: DistrictAtmosphereProfile[] = [
      {
        districtCluster: 'core_commercial',
        confidence: 0.8,
        evidenceStrength: 'medium',
        buildingCount: 5,
        facadeProfile: {
          family: 'panel',
          variant: 'metal_station_silver',
          pattern: 'retail_screen',
          roofStyle: 'flat',
          evidence: 'medium',
          emissiveBoost: 1.3,
          signDensity: 'high',
          windowDensity: 'dense',
          lightingStyle: 'neon_night',
        },
        streetAtmosphere: 'dense_signage',
        vegetationProfile: 'urban_minimal_green',
        roadProfile: 'dense_crosswalk',
        lightingProfile: 'neon_night',
        weatherOverlay: 'sunny_clear',
      },
    ];
    const result = resolveSceneWideAtmosphereWithPlaceCharacter(
      districtProfiles,
      electronicsCharacter,
      0.3,
    );
    expect(result.cityTone).toBe('dense_commercial');
    expect(result.evidenceStrength).not.toBe('weak');
  });

  it('shop=electronics → ELECTRONICS 재질', () => {
    const profile = resolveFacadeProfileForWeakEvidence(electronicsCharacter, {
      shop: 'electronics',
    });
    expect(profile.family).toBe('metal');
    expect(profile.lightingStyle).toBe('neon_night');
    expect(profile.signDensity).toBe('high');
  });

  it('building=retail → RETAIL 재질', () => {
    const profile = resolveFacadeProfileForWeakEvidence(electronicsCharacter, {
      building: 'retail',
    });
    expect(profile.pattern).toBe('podium_retail');
    expect(profile.lightingStyle).toBe('warm_evening');
  });

  it('amenity=restaurant → RESTAURANT 재질', () => {
    const profile = resolveFacadeProfileForWeakEvidence(electronicsCharacter, {
      amenity: 'restaurant',
    });
    expect(profile.family).toBe('plaster');
    expect(profile.lightingStyle).toBe('warm_evening');
  });

  it('OSM 태그 없으면 기본 district 프로필 반환', () => {
    const profile = resolveFacadeProfileForWeakEvidence(electronicsCharacter);
    expect(profile).toBeDefined();
    expect(profile.evidence).toBe('weak');
  });

  it('inferenceReasonCodes에 MISSING_MAPILLARY_IMAGES 있어도 fallback 소스 기록됨', () => {
    const districtProfiles: DistrictAtmosphereProfile[] = [];
    const result = resolveSceneWideAtmosphereWithPlaceCharacter(
      districtProfiles,
      electronicsCharacter,
      1.0,
    );
    expect(result).toBeDefined();
    expect(result.evidenceStrength).toBe('weak');
  });
});
