import { Module } from '@nestjs/common';
import { CacheModule } from '../../cache/cache.module';
import { PlacesModule } from '../../places/places.module';
import { SceneStorageModule } from './scene-storage.module';
import { SceneLiveDataService } from '../services/live';
import { SceneStateLiveService } from '../services/live/scene-state-live.service';
import { SceneTrafficLiveService } from '../services/live/scene-traffic-live.service';
import { SceneWeatherLiveService } from '../services/live/scene-weather-live.service';

@Module({
  imports: [CacheModule, PlacesModule, SceneStorageModule],
  providers: [
    SceneStateLiveService,
    SceneWeatherLiveService,
    SceneTrafficLiveService,
    SceneLiveDataService,
  ],
  exports: [
    SceneStateLiveService,
    SceneWeatherLiveService,
    SceneTrafficLiveService,
    SceneLiveDataService,
  ],
})
export class SceneLiveModule {}
