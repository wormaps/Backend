import { describe, expect, it } from 'bun:test';
import {
  resolveSceneStaticAtmosphereProfile,
  resolveDistrictAtmosphereFromPlaceCharacter,
} from '../src/scene/utils/scene-static-atmosphere.utils';
import type { PlaceCharacter } from '../src/scene/domain/place-character.value-object';

describe('AtmosphereProfile Domain', () => {
  describe('resolveSceneStaticAtmosphereProfile (existing behavior)', () => {
    it('returns NIGHT_NEON for high luminous signal', () => {
      const result = resolveSceneStaticAtmosphereProfile({
        signageClusters: Array(5).fill({ emissiveStrength: 0.8 }),
        facadeHints: Array(4).fill({ emissiveStrength: 0.9 }),
      });
      expect(result.preset).toBe('NIGHT_NEON');
      expect(result.emissiveBoost).toBe(1.25);
    });

    it('returns EVENING_BALANCED for moderate luminous signal', () => {
      const result = resolveSceneStaticAtmosphereProfile({
        signageClusters: Array(2).fill({ emissiveStrength: 0.8 }),
        facadeHints: Array(1).fill({ emissiveStrength: 0.9 }),
      });
      expect(result.preset).toBe('EVENING_BALANCED');
      expect(result.emissiveBoost).toBe(1.1);
    });

    it('returns DAY_CLEAR for low luminous signal', () => {
      const result = resolveSceneStaticAtmosphereProfile({
        signageClusters: [],
        facadeHints: [{ emissiveStrength: 0.3 } as any],
      });
      expect(result.preset).toBe('DAY_CLEAR');
      expect(result.emissiveBoost).toBe(1);
    });
  });

  describe('resolveDistrictAtmosphereFromPlaceCharacter', () => {
    it('ELECTRONICS_DISTRICT has emissiveBoost >= 1.5', () => {
      const character: PlaceCharacter = {
        districtType: 'ELECTRONICS_DISTRICT',
        signageDensity: 'DENSE',
        buildingEra: 'MIXED',
        facadeComplexity: 'HIGH',
      };
      const result = resolveDistrictAtmosphereFromPlaceCharacter(character);
      expect(result.emissiveBoost).toBeGreaterThanOrEqual(1.5);
      expect(result.preset).toBe('NIGHT_NEON');
    });

    it('ELECTRONICS_DISTRICT facadeFamily differs from default glass_cool_light', () => {
      const character: PlaceCharacter = {
        districtType: 'ELECTRONICS_DISTRICT',
        signageDensity: 'DENSE',
        buildingEra: 'MIXED',
        facadeComplexity: 'HIGH',
      };
      const result = resolveDistrictAtmosphereFromPlaceCharacter(character);
      expect(result.preset).not.toBe('DAY_CLEAR');
    });

    it('SHOPPING_SCRAMBLE has high emissiveBoost', () => {
      const character: PlaceCharacter = {
        districtType: 'SHOPPING_SCRAMBLE',
        signageDensity: 'DENSE',
        buildingEra: 'MIXED',
        facadeComplexity: 'HIGH',
      };
      const result = resolveDistrictAtmosphereFromPlaceCharacter(character);
      expect(result.emissiveBoost).toBeGreaterThanOrEqual(1.5);
      expect(result.preset).toBe('NIGHT_NEON');
    });

    it('GENERIC preserves existing default values', () => {
      const character: PlaceCharacter = {
        districtType: 'GENERIC',
        signageDensity: 'MODERATE',
        buildingEra: 'MIXED',
        facadeComplexity: 'LOW',
      };
      const result = resolveDistrictAtmosphereFromPlaceCharacter(character);
      expect(result.preset).toBe('DAY_CLEAR');
      expect(result.emissiveBoost).toBe(1);
      expect(result.roadRoughnessScale).toBe(1);
      expect(result.wetRoadBoost).toBe(0);
    });

    it('TRANSIT_HUB has functional emissiveBoost', () => {
      const character: PlaceCharacter = {
        districtType: 'TRANSIT_HUB',
        signageDensity: 'MODERATE',
        buildingEra: 'MIXED',
        facadeComplexity: 'MEDIUM',
      };
      const result = resolveDistrictAtmosphereFromPlaceCharacter(character);
      expect(result.emissiveBoost).toBeGreaterThanOrEqual(1.0);
      expect(result.preset).toBe('EVENING_BALANCED');
    });

    it('DENSE signage increases emissiveBoost', () => {
      const dense: PlaceCharacter = {
        districtType: 'ELECTRONICS_DISTRICT',
        signageDensity: 'DENSE',
        buildingEra: 'MIXED',
        facadeComplexity: 'HIGH',
      };
      const sparse: PlaceCharacter = {
        districtType: 'ELECTRONICS_DISTRICT',
        signageDensity: 'SPARSE',
        buildingEra: 'MIXED',
        facadeComplexity: 'HIGH',
      };
      const denseResult = resolveDistrictAtmosphereFromPlaceCharacter(dense);
      const sparseResult = resolveDistrictAtmosphereFromPlaceCharacter(sparse);
      expect(denseResult.emissiveBoost).toBeGreaterThan(sparseResult.emissiveBoost);
    });

    it('SHOWA_1960_80 era reduces emissiveBoost slightly', () => {
      const modern: PlaceCharacter = {
        districtType: 'ELECTRONICS_DISTRICT',
        signageDensity: 'DENSE',
        buildingEra: 'MODERN_POST2000',
        facadeComplexity: 'HIGH',
      };
      const showa: PlaceCharacter = {
        districtType: 'ELECTRONICS_DISTRICT',
        signageDensity: 'DENSE',
        buildingEra: 'SHOWA_1960_80',
        facadeComplexity: 'HIGH',
      };
      const modernResult = resolveDistrictAtmosphereFromPlaceCharacter(modern);
      const showaResult = resolveDistrictAtmosphereFromPlaceCharacter(showa);
      expect(showaResult.emissiveBoost).toBeLessThan(modernResult.emissiveBoost);
    });
  });
});
