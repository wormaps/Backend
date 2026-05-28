import { OsmSceneBuildService } from './application/osm-scene-build.service';
import { OsmSnapshotService } from './application/osm-snapshot.service';
import { OverpassAdapter } from './infrastructure/overpass.adapter';
import { SnapshotCollectorService } from './application/snapshot-collector.service';
import { WeatherSnapshotService } from './application/weather-snapshot.service';
import { TrafficSnapshotService } from './application/traffic-snapshot.service';
import { GooglePlacesAdapter } from './infrastructure/google-places.adapter';
import { PlacesSnapshotService } from './application/places-snapshot.service';
import { TomTomTrafficAdapter } from './infrastructure/tomtom-traffic.adapter';

const tomtomApiKey = process.env.TOMTOM_API_KEY ?? '';
const googleApiKey = process.env.GOOGLE_API_KEY ?? '';
const mapboxToken = process.env.MAPBOX_TOKEN;

export const providersModule = {
  name: 'providers',
  services: {
    snapshotCollector: new SnapshotCollectorService(),
    osmSnapshot: new OsmSnapshotService(),
    weatherSnapshot: new WeatherSnapshotService(),
    trafficSnapshot: new TrafficSnapshotService(new TomTomTrafficAdapter(tomtomApiKey)),
    googlePlaces: new GooglePlacesAdapter(googleApiKey),
    placesSnapshot: new PlacesSnapshotService(new GooglePlacesAdapter(googleApiKey)),
    osmSceneBuild: OsmSceneBuildService.create(new OverpassAdapter(), mapboxToken),
  },
} as const;

export function validateProviderApiKeys(options?: { strict?: boolean }): void {
  const missing: string[] = [];
  if (!googleApiKey) missing.push('GOOGLE_API_KEY');
  if (!tomtomApiKey) missing.push('TOMTOM_API_KEY');

  if (missing.length > 0) {
    const message = `Missing required environment variable(s): ${missing.join(', ')}`;
    if (options?.strict ?? true) {
      throw new Error(message);
    }
    // eslint-disable-next-line no-console
    console.warn(message);
  }
}
