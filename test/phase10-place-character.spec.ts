import { describe, expect, it } from 'bun:test';
import { resolvePlaceCharacter } from '../src/scene/domain/place-character.value-object';
import type { BuildingData } from '../src/places/types/place.types';

function makeBuilding(overrides: Partial<BuildingData> = {}): BuildingData {
  return {
    id: 'b1',
    name: 'Test Building',
    heightMeters: 15,
    outerRing: [
      { lat: 35.7, lng: 139.7 },
      { lat: 35.701, lng: 139.7 },
      { lat: 35.701, lng: 139.701 },
      { lat: 35.7, lng: 139.701 },
    ],
    holes: [],
    footprint: [],
    usage: 'COMMERCIAL',
    ...overrides,
  };
}

describe('PlaceCharacter Domain', () => {
  it('returns GENERIC for empty buildings array', () => {
    const result = resolvePlaceCharacter([]);
    expect(result.districtType).toBe('GENERIC');
    expect(result.signageDensity).toBe('SPARSE');
    expect(result.buildingEra).toBe('MIXED');
    expect(result.facadeComplexity).toBe('LOW');
  });

  it('maps Google Places type electronics_store to ELECTRONICS_DISTRICT', () => {
    const buildings = [
      makeBuilding({
        googlePlacesInfo: {
          placeId: 'gp1',
          primaryType: 'electronics_store',
          types: ['electronics_store', 'store', 'point_of_interest'],
        },
      }),
    ];
    const result = resolvePlaceCharacter(buildings);
    expect(result.districtType).toBe('ELECTRONICS_DISTRICT');
  });

  it('maps Google Places type tourist_attraction to SHOPPING_SCRAMBLE', () => {
    const buildings = [
      makeBuilding({
        googlePlacesInfo: {
          placeId: 'gp1',
          primaryType: 'tourist_attraction',
          types: ['tourist_attraction'],
        },
      }),
    ];
    const result = resolvePlaceCharacter(buildings);
    expect(result.districtType).toBe('SHOPPING_SCRAMBLE');
  });

  it('maps OSM shop=electronics to ELECTRONICS_DISTRICT with DENSE signage', () => {
    const buildings = [
      makeBuilding({
        osmAttributes: { shop: 'electronics' },
      }),
      makeBuilding({
        osmAttributes: { shop: 'electronics' },
      }),
      makeBuilding({
        osmAttributes: { shop: 'computer' },
      }),
    ];
    const result = resolvePlaceCharacter(buildings);
    expect(result.districtType).toBe('ELECTRONICS_DISTRICT');
    expect(result.signageDensity).toBe('DENSE');
  });

  it('maps OSM landuse=commercial to MODERATE signage', () => {
    const buildings = [
      makeBuilding({
        osmAttributes: { landuse: 'commercial' },
      }),
    ];
    const result = resolvePlaceCharacter(buildings);
    expect(result.signageDensity).toBe('MODERATE');
  });

  it('maps OSM landuse=retail to DENSE signage', () => {
    const buildings = [
      makeBuilding({
        osmAttributes: { landuse: 'retail' },
      }),
    ];
    const result = resolvePlaceCharacter(buildings);
    expect(result.signageDensity).toBe('DENSE');
  });

  it('maps tall buildings to MODERN_POST2000 era', () => {
    const buildings = [
      makeBuilding({ heightMeters: 50 }),
      makeBuilding({ heightMeters: 40 }),
    ];
    const result = resolvePlaceCharacter(buildings);
    expect(result.buildingEra).toBe('MODERN_POST2000');
  });

  it('maps short buildings to SHOWA_1960_80 era', () => {
    const buildings = [
      makeBuilding({ heightMeters: 8 }),
      makeBuilding({ heightMeters: 6 }),
    ];
    const result = resolvePlaceCharacter(buildings);
    expect(result.buildingEra).toBe('SHOWA_1960_80');
  });

  it('maps start_date >= 2000 to MODERN_POST2000', () => {
    const buildings = [
      makeBuilding({
        osmAttributes: { start_date: '2005' },
      }),
    ];
    const result = resolvePlaceCharacter(buildings);
    expect(result.buildingEra).toBe('MODERN_POST2000');
  });

  it('maps start_date 1960-1989 to SHOWA_1960_80', () => {
    const buildings = [
      makeBuilding({
        osmAttributes: { start_date: '1975' },
      }),
    ];
    const result = resolvePlaceCharacter(buildings);
    expect(result.buildingEra).toBe('SHOWA_1960_80');
  });

  it('maps buildings with holes + color + material to HIGH complexity', () => {
    const buildings = [
      makeBuilding({
        holes: [[{ lat: 0, lng: 0 }]],
        facadeColor: '#ffffff',
        facadeMaterial: 'concrete',
      }),
    ];
    const result = resolvePlaceCharacter(buildings);
    expect(result.facadeComplexity).toBe('HIGH');
  });

  it('maps buildings with only color to MEDIUM complexity', () => {
    const buildings = [
      makeBuilding({
        facadeColor: '#ffffff',
      }),
    ];
    const result = resolvePlaceCharacter(buildings);
    expect(result.facadeComplexity).toBe('MEDIUM');
  });

  it('maps buildings with no attributes to LOW complexity', () => {
    const buildings = [makeBuilding()];
    const result = resolvePlaceCharacter(buildings);
    expect(result.facadeComplexity).toBe('LOW');
  });

  it('maps train_station to TRANSIT_HUB', () => {
    const buildings = [
      makeBuilding({
        googlePlacesInfo: {
          placeId: 'gp1',
          primaryType: 'train_station',
        },
      }),
    ];
    const result = resolvePlaceCharacter(buildings);
    expect(result.districtType).toBe('TRANSIT_HUB');
  });

  it('maps corporate_office to OFFICE_DISTRICT', () => {
    const buildings = [
      makeBuilding({
        googlePlacesInfo: {
          placeId: 'gp1',
          primaryType: 'corporate_office',
        },
      }),
    ];
    const result = resolvePlaceCharacter(buildings);
    expect(result.districtType).toBe('OFFICE_DISTRICT');
  });

  it('maps apartment_building to RESIDENTIAL', () => {
    const buildings = [
      makeBuilding({
        googlePlacesInfo: {
          placeId: 'gp1',
          primaryType: 'apartment_building',
        },
      }),
    ];
    const result = resolvePlaceCharacter(buildings);
    expect(result.districtType).toBe('RESIDENTIAL');
  });
});
