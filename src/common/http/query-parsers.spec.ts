import { AppException } from '../errors/app.exception';
import { ERROR_CODES } from '../constants/error-codes';
import {
  validateGooglePlaceId,
  validateLatLngRange,
  validatePlaceId,
  validateSceneId,
} from './query-parsers';

describe('query-parsers', () => {
  it('accepts valid scene and place identifiers', () => {
    expect(validateSceneId('scene-seoul-city-hall')).toBe(
      'scene-seoul-city-hall',
    );
    expect(validatePlaceId('scene-seoul-city-hall')).toBe(
      'scene-seoul-city-hall',
    );
    expect(validateGooglePlaceId('ChIJ123_test-ABC')).toBe(
      'ChIJ123_test-ABC',
    );
  });

  it('rejects overlong scene and place identifiers', () => {
    expect(() => validateSceneId('a'.repeat(65))).toThrow(AppException);
    expect(() => validatePlaceId('a'.repeat(257))).toThrow(AppException);
    expect(() => validateGooglePlaceId('a'.repeat(257))).toThrow(
      AppException,
    );

    try {
      validateSceneId('a'.repeat(65));
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).code).toBe(ERROR_CODES.INVALID_SCENE_ID);
    }
  });

  it('rejects invalid latitude and longitude ranges', () => {
    expect(() => validateLatLngRange(91, 0)).toThrow(AppException);
    expect(() => validateLatLngRange(0, 181)).toThrow(AppException);
    expect(() => validateLatLngRange(Number.NaN, 0)).toThrow(AppException);
  });
});
