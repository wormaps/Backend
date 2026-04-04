import { Injectable } from '@nestjs/common';
import {
  PLACE_TYPES,
  PlaceType,
  RegistryInfo,
  SceneSnapshot,
  TimeOfDay,
  WeatherType,
} from './place.types';

const PLACE_TYPE_BASELINES: Record<PlaceType, { crowd: number; vehicles: number }> = {
  CROSSING: { crowd: 160, vehicles: 70 },
  SQUARE: { crowd: 140, vehicles: 55 },
  STATION: { crowd: 180, vehicles: 85 },
  PLAZA: { crowd: 100, vehicles: 40 },
};

const TIME_MULTIPLIERS: Record<TimeOfDay, { crowd: number; vehicles: number }> = {
  DAY: { crowd: 1, vehicles: 1 },
  EVENING: { crowd: 1.2, vehicles: 1.1 },
  NIGHT: { crowd: 0.75, vehicles: 0.55 },
};

const WEATHER_MULTIPLIERS: Record<WeatherType, { crowd: number; vehicles: number }> = {
  CLEAR: { crowd: 1, vehicles: 1 },
  CLOUDY: { crowd: 0.95, vehicles: 0.95 },
  RAIN: { crowd: 0.7, vehicles: 0.85 },
  SNOW: { crowd: 0.55, vehicles: 0.6 },
};

@Injectable()
export class SnapshotBuilderService {
  build(place: RegistryInfo, timeOfDay: TimeOfDay, weather: WeatherType): SceneSnapshot {
    if (!PLACE_TYPES.includes(place.placeType)) {
      throw new Error(`Unsupported place type: ${place.placeType}`);
    }

    const base = PLACE_TYPE_BASELINES[place.placeType];
    const crowdCount = this.roundCount(
      base.crowd * TIME_MULTIPLIERS[timeOfDay].crowd * WEATHER_MULTIPLIERS[weather].crowd,
    );
    const vehicleCount = this.roundCount(
      base.vehicles * TIME_MULTIPLIERS[timeOfDay].vehicles * WEATHER_MULTIPLIERS[weather].vehicles,
    );

    return {
      placeId: place.id,
      timeOfDay,
      weather,
      generatedAt: new Date().toISOString(),
      source: 'MVP_SYNTHETIC_RULES',
      crowd: {
        count: crowdCount,
        level: this.resolveLevel(crowdCount, [90, 150]),
      },
      vehicles: {
        count: vehicleCount,
        level: this.resolveLevel(vehicleCount, [45, 75]),
      },
      lighting: {
        ambient: this.resolveAmbient(timeOfDay),
        neon: timeOfDay !== 'DAY',
        buildingLights: timeOfDay !== 'DAY',
        vehicleLights: timeOfDay !== 'DAY' || weather === 'RAIN' || weather === 'SNOW',
      },
      surface: {
        wetRoad: weather === 'RAIN',
        puddles: weather === 'RAIN',
        snowCover: weather === 'SNOW',
      },
      playback: {
        recommendedSpeed: this.resolveSpeed(timeOfDay),
        pedestrianAnimationRate: timeOfDay === 'NIGHT' ? 0.85 : 1,
        vehicleAnimationRate: weather === 'SNOW' ? 0.7 : weather === 'RAIN' ? 0.85 : 1,
      },
    };
  }

  private roundCount(value: number): number {
    return Math.max(0, Math.round(value));
  }

  private resolveLevel(value: number, thresholds: [number, number]): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (value < thresholds[0]) {
      return 'LOW';
    }

    if (value < thresholds[1]) {
      return 'MEDIUM';
    }

    return 'HIGH';
  }

  private resolveAmbient(timeOfDay: TimeOfDay): 'BRIGHT' | 'SOFT' | 'DIM' {
    if (timeOfDay === 'DAY') {
      return 'BRIGHT';
    }

    if (timeOfDay === 'EVENING') {
      return 'SOFT';
    }

    return 'DIM';
  }

  private resolveSpeed(timeOfDay: TimeOfDay): 1 | 2 | 4 | 8 {
    if (timeOfDay === 'DAY') {
      return 2;
    }

    if (timeOfDay === 'EVENING') {
      return 4;
    }

    return 1;
  }
}
