import { SnapshotBuilderService } from './snapshot-builder.service';
import { RegistryInfo } from '../types/place.types';

describe('SnapshotBuilderService', () => {
  const service = new SnapshotBuilderService();
  const place: RegistryInfo = {
    id: 'gangnam-station',
    slug: 'gangnam-station',
    name: 'Gangnam Station',
    country: 'South Korea',
    city: 'Seoul',
    location: { lat: 37.4979, lng: 127.0276 },
    placeType: 'STATION',
    tags: ['transit'],
  };

  it('should build a deterministic day snapshot from rules', () => {
    const snapshot = service.build(place, 'DAY', 'CLEAR');

    expect(snapshot.placeId).toBe('gangnam-station');
    expect(snapshot.timeOfDay).toBe('DAY');
    expect(snapshot.weather).toBe('CLEAR');
    expect(snapshot.crowd.count).toBe(180);
    expect(snapshot.crowd.level).toBe('HIGH');
    expect(snapshot.vehicles.count).toBe(85);
    expect(snapshot.vehicles.level).toBe('HIGH');
    expect(snapshot.lighting.ambient).toBe('BRIGHT');
    expect(snapshot.lighting.neon).toBe(false);
    expect(snapshot.surface.wetRoad).toBe(false);
  });

  it('should reduce densities in snow at night', () => {
    const snapshot = service.build(place, 'NIGHT', 'SNOW');

    expect(snapshot.crowd.count).toBe(74);
    expect(snapshot.crowd.level).toBe('LOW');
    expect(snapshot.vehicles.count).toBe(28);
    expect(snapshot.vehicles.level).toBe('LOW');
    expect(snapshot.lighting.ambient).toBe('DIM');
    expect(snapshot.lighting.vehicleLights).toBe(true);
    expect(snapshot.surface.snowCover).toBe(true);
    expect(snapshot.playback.vehicleAnimationRate).toBe(0.7);
  });
});
