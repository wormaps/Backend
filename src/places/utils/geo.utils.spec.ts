import { normalizeCoordinate } from './geo.utils';

describe('geo.utils', () => {
  it('rejects coordinates outside the valid range', () => {
    expect(normalizeCoordinate({ lat: 91, lng: 0 })).toBeNull();
    expect(normalizeCoordinate({ lat: 0, lng: 181 })).toBeNull();
    expect(normalizeCoordinate({ latitude: -91, longitude: 0 })).toBeNull();
  });

  it('normalizes valid coordinates', () => {
    expect(normalizeCoordinate({ lat: 37.5665, lng: 126.978 })).toEqual({
      lat: 37.5665,
      lng: 126.978,
    });
  });
});
