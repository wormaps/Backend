import { OverpassClient } from './overpass.client';
import { ExternalPlaceDetail } from './external-place.types';

describe('OverpassClient', () => {
  const place: ExternalPlaceDetail = {
    provider: 'GOOGLE_PLACES',
    placeId: 'abc123',
    displayName: 'Test',
    formattedAddress: null,
    location: { lat: 37.15, lng: 127.15 },
    primaryType: null,
    types: [],
    googleMapsUri: null,
    viewport: {
      northEast: { lat: 37.3, lng: 127.3 },
      southWest: { lat: 37.0, lng: 127.0 },
    },
    utcOffsetMinutes: null,
  };

  it('should convert overpass response to place package', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            elements: [
              {
                type: 'way',
                id: 1,
                tags: {
                  building: 'yes',
                  name: 'Tower',
                  'building:levels': '10',
                },
                geometry: [
                  { lat: 37.1, lon: 127.1 },
                  { lat: 37.2, lon: 127.1 },
                  { lat: 37.2, lon: 127.2 },
                ],
              },
              {
                type: 'way',
                id: 2,
                tags: {
                  highway: 'primary',
                  name: 'Main Road',
                  lanes: '4',
                  width: '14',
                },
                geometry: [
                  { lat: 37.1, lon: 127.1 },
                  { lat: 37.2, lon: 127.2 },
                ],
              },
              {
                type: 'way',
                id: 4,
                tags: { highway: 'footway', name: 'Main Walkway', width: '5' },
                geometry: [
                  { lat: 37.11, lon: 127.11 },
                  { lat: 37.12, lon: 127.12 },
                ],
              },
              {
                type: 'node',
                id: 3,
                lat: 37.15,
                lon: 127.15,
                tags: { tourism: 'attraction', name: 'Landmark' },
              },
            ],
          }),
        ),
    });
    const client = new OverpassClient().withFetcher(fetcher as typeof fetch);

    const result = await client.buildPlacePackage(place);

    expect(result.placeId).toBe('abc123');
    expect(result.buildings).toHaveLength(1);
    expect(result.buildings[0]?.outerRing).toHaveLength(3);
    expect(result.buildings[0]?.holes).toHaveLength(0);
    expect(result.roads).toHaveLength(1);
    expect(result.roads[0]?.roadClass).toBe('primary');
    expect(result.roads[0]?.widthMeters).toBe(14);
    expect(result.walkways).toHaveLength(1);
    expect(result.walkways[0]?.walkwayType).toBe('footway');
    expect(result.landmarks).toHaveLength(1);
    expect(result.diagnostics).toEqual({
      droppedBuildings: 0,
      droppedRoads: 0,
      droppedWalkways: 0,
      droppedPois: 0,
      droppedCrossings: 0,
      droppedStreetFurniture: 0,
      droppedVegetation: 0,
      droppedLandCovers: 0,
      droppedLinearFeatures: 0,
    });
  });

  it('should drop invalid geometry and retain all valid features without truncation', async () => {
    const validBuildings = Array.from({ length: 120 }, (_, index) => ({
      type: 'way',
      id: index + 1,
      tags: {
        building: 'yes',
        name: `Building ${index + 1}`,
        'building:levels': '6',
      },
      geometry: [
        { lat: 37.1 + index * 0.00001, lon: 127.1 },
        { lat: 37.1002 + index * 0.00001, lon: 127.1 },
        { lat: 37.1002 + index * 0.00001, lon: 127.1002 },
      ],
    }));

    const response = {
      elements: [
        ...validBuildings,
        {
          type: 'way',
          id: 9991,
          tags: { building: 'yes', name: 'Broken Building' },
          geometry: [
            { lat: 37.11, lon: 127.11 },
            { lat: 37.11, lon: 127.11 },
            { lat: 37.11, lon: 127.11 },
          ],
        },
        {
          type: 'way',
          id: 9992,
          tags: { highway: 'primary', name: 'Broken Road' },
          geometry: [{ lat: 37.12, lon: 127.12 }],
        },
        {
          type: 'way',
          id: 9993,
          tags: { highway: 'footway', name: 'Broken Walkway' },
          geometry: [{ lat: 37.13, lon: 127.13 }],
        },
        {
          type: 'node',
          id: 9994,
          lat: Number.NaN,
          lon: 127.15,
          tags: { tourism: 'attraction', name: 'Broken Poi' },
        },
      ],
    };

    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(response)),
    });
    const client = new OverpassClient().withFetcher(fetcher as typeof fetch);

    const result = await client.buildPlacePackage(place, { radiusM: 600 });

    expect(result.buildings).toHaveLength(120);
    expect(result.roads).toHaveLength(0);
    expect(result.walkways).toHaveLength(0);
    expect(result.pois).toHaveLength(0);
    expect(result.diagnostics).toEqual({
      droppedBuildings: 1,
      droppedRoads: 1,
      droppedWalkways: 1,
      droppedPois: 1,
      droppedCrossings: 0,
      droppedStreetFurniture: 0,
      droppedVegetation: 0,
      droppedLandCovers: 0,
      droppedLinearFeatures: 0,
    });
  });

  it('should convert multipolygon building relations into outerRing + holes', async () => {
    const response = {
      elements: [
        {
          type: 'relation',
          id: 501,
          tags: {
            type: 'multipolygon',
            building: 'yes',
            name: 'Courtyard Complex',
            height: '28',
          },
          members: [
            {
              type: 'way',
              ref: 11,
              role: 'outer',
              geometry: [
                { lat: 37.1, lon: 127.1 },
                { lat: 37.1, lon: 127.1005 },
                { lat: 37.1005, lon: 127.1005 },
                { lat: 37.1005, lon: 127.1 },
                { lat: 37.1, lon: 127.1 },
              ],
            },
            {
              type: 'way',
              ref: 12,
              role: 'inner',
              geometry: [
                { lat: 37.10015, lon: 127.10015 },
                { lat: 37.10015, lon: 127.10035 },
                { lat: 37.10035, lon: 127.10035 },
                { lat: 37.10035, lon: 127.10015 },
                { lat: 37.10015, lon: 127.10015 },
              ],
            },
          ],
        },
      ],
    };
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(response)),
    });

    const client = new OverpassClient().withFetcher(fetcher as typeof fetch);
    const result = await client.buildPlacePackage(place);

    expect(result.buildings).toHaveLength(1);
    expect(result.buildings[0]?.outerRing).toHaveLength(4);
    expect(result.buildings[0]?.holes).toHaveLength(1);
    expect(result.buildings[0]?.holes[0]).toHaveLength(4);
    expect(result.buildings[0]?.footprint).toEqual(result.buildings[0]?.outerRing);
  });

  it('should fallback to the next overpass endpoint when the first one fails', async () => {
    const emptyResponse = {
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ elements: [] })),
    };
    const buildingResponse = {
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            elements: [
              {
                type: 'way',
                id: 10,
                tags: { building: 'yes', name: 'Fallback Tower' },
                geometry: [
                  { lat: 37.1, lon: 127.1 },
                  { lat: 37.2, lon: 127.1 },
                  { lat: 37.2, lon: 127.2 },
                ],
              },
            ],
          }),
        ),
    };
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 504,
        text: () => Promise.resolve('gateway timeout'),
      })
      .mockResolvedValueOnce(buildingResponse)
      .mockResolvedValueOnce(emptyResponse)
      .mockResolvedValueOnce(emptyResponse);

    const client = new OverpassClient().withFetcher(fetcher as typeof fetch);
    const result = await client.buildPlacePackage(place);

    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(result.buildings).toHaveLength(1);
    expect(result.buildings[0]?.name).toBe('Fallback Tower');
  });
});
