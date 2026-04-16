import { SceneLiveDataService } from './scene-live-data.service';

describe('SceneLiveDataService', () => {
  it('delegates state, weather, traffic, and entity state requests', async () => {
    const sceneStateLiveService = {
      getState: jest.fn().mockResolvedValue({ kind: 'state' }),
      getEntityState: jest.fn().mockResolvedValue({ kind: 'entity' }),
    } as any;
    const sceneWeatherLiveService = {
      getWeather: jest.fn().mockResolvedValue({ kind: 'weather' }),
    } as any;
    const sceneTrafficLiveService = {
      getTraffic: jest.fn().mockResolvedValue({ kind: 'traffic' }),
    } as any;

    const service = new SceneLiveDataService(
      sceneStateLiveService,
      sceneWeatherLiveService,
      sceneTrafficLiveService,
    );

    await expect(service.getState('scene-1', { timeOfDay: 'DAY' } as any)).resolves.toEqual({
      kind: 'state',
    });
    await expect(
      service.getEntityState('scene-1', { timeOfDay: 'DAY' } as any),
    ).resolves.toEqual({ kind: 'entity' });
    await expect(
      service.getWeather('scene-1', { timeOfDay: 'DAY' } as any),
    ).resolves.toEqual({ kind: 'weather' });
    await expect(service.getTraffic('scene-1')).resolves.toEqual({
      kind: 'traffic',
    });

    expect(sceneStateLiveService.getState).toHaveBeenCalledWith('scene-1', {
      timeOfDay: 'DAY',
    });
    expect(sceneStateLiveService.getEntityState).toHaveBeenCalledWith(
      'scene-1',
      { timeOfDay: 'DAY' },
    );
    expect(sceneWeatherLiveService.getWeather).toHaveBeenCalledWith('scene-1', {
      timeOfDay: 'DAY',
    });
    expect(sceneTrafficLiveService.getTraffic).toHaveBeenCalledWith('scene-1');
  });
});
