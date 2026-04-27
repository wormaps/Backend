import { createHash } from 'node:crypto';
import { GooglePlacesAdapter, type PlacesData } from '../infrastructure/google-places.adapter';
import type { SceneScope } from '../../../packages/contracts/twin-scene-graph';
import type { SourceSnapshot } from '../../../packages/contracts/source-snapshot';

const GOOGLE_PLACES_CATEGORIES = [
  'restaurant', 'cafe', 'park', 'school', 'hospital',
  'shopping_mall', 'supermarket', 'bank', 'hotel', 'museum',
  'gym', 'pharmacy', 'gas_station', 'parking', 'transit_station',
];

export class PlacesSnapshotService {
  constructor(private readonly googlePlaces: GooglePlacesAdapter) {}

  async createSnapshot(
    sceneId: string,
    bundleId: string,
    scope: SceneScope,
  ): Promise<{ snapshot: SourceSnapshot; places: PlacesData }> {
    const lat = scope.center.lat;
    const lng = scope.center.lng;
    const radius = scope.radiusMeters ?? 150;

    const places = await this.googlePlaces.searchPlaces('places', lat, lng, radius);

    const rawJson = JSON.stringify(places);
    const responseHash = `sha256:${createHash('sha256').update(rawJson).digest('hex')}`;

    return {
      snapshot: {
        id: `snapshot:places:${bundleId}`,
        provider: 'google_places',
        sceneId,
        requestedAt: new Date().toISOString(),
        queryHash: `sha256:${createHash('sha256').update(`${lat},${lng},${radius}`).digest('hex')}`,
        responseHash,
        storageMode: 'metadata_only',
        payloadRef: rawJson,
        payloadSchemaVersion: 'google-places.v1',
        status: places.places.length > 0 ? 'success' : 'partial',
        compliance: {
          provider: 'google_places',
          attributionRequired: true,
          attributionText: 'Google',
          retentionPolicy: 'cache_allowed',
          policyVersion: '1.0.0',
        },
      },
      places,
    };
  }

  getPlaceCategories(): string[] {
    return GOOGLE_PLACES_CATEGORIES;
  }
}
