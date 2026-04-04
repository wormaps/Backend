import { Injectable } from '@nestjs/common';
import { fetchJson } from '../common/http/fetch-json';
import type { FetchLike } from '../common/http/fetch-json';
import {
  ExternalPlaceDetail,
  WeatherObservation,
} from './external-place.types';
import { TimeOfDay, WeatherType } from './place.types';

interface OpenMeteoResponse {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation?: number[];
    rain?: number[];
    snowfall?: number[];
    cloud_cover?: number[];
  };
}

@Injectable()
export class OpenMeteoClient {
  private fetcher: FetchLike = fetch;

  withFetcher(fetcher: FetchLike): this {
    this.fetcher = fetcher;
    return this;
  }

  async getHistoricalObservation(
    place: ExternalPlaceDetail,
    date: string,
    timeOfDay: TimeOfDay,
  ): Promise<WeatherObservation | null> {
    const response = await fetchJson<OpenMeteoResponse>(
      {
        provider: 'Open-Meteo Historical Weather',
        url:
          `https://archive-api.open-meteo.com/v1/archive?latitude=${place.location.lat}` +
          `&longitude=${place.location.lng}` +
          `&start_date=${date}&end_date=${date}` +
          '&hourly=temperature_2m,precipitation,rain,snowfall,cloud_cover' +
          '&timezone=auto',
      },
      this.fetcher,
    );

    const targetHour = this.resolveHour(timeOfDay);
    const hourly = response.hourly;
    const times = hourly?.time ?? [];
    const index = times.findIndex((value) =>
      value.endsWith(`T${targetHour}:00`),
    );
    if (index < 0) {
      return null;
    }

    const rain = hourly?.rain?.[index] ?? null;
    const snowfall = hourly?.snowfall?.[index] ?? null;
    const precipitation = hourly?.precipitation?.[index] ?? null;
    const cloudCover = hourly?.cloud_cover?.[index] ?? null;

    return {
      date,
      localTime: times[index],
      temperatureCelsius: hourly?.temperature_2m?.[index] ?? null,
      precipitationMm: precipitation,
      rainMm: rain,
      snowfallCm: snowfall,
      cloudCoverPercent: cloudCover,
      resolvedWeather: this.resolveWeather(
        rain,
        snowfall,
        precipitation,
        cloudCover,
      ),
      source: 'OPEN_METEO_HISTORICAL',
    };
  }

  private resolveHour(timeOfDay: TimeOfDay): string {
    if (timeOfDay === 'DAY') {
      return '12';
    }

    if (timeOfDay === 'EVENING') {
      return '18';
    }

    return '22';
  }

  private resolveWeather(
    rain: number | null,
    snowfall: number | null,
    precipitation: number | null,
    cloudCover: number | null,
  ): WeatherType {
    if ((snowfall ?? 0) > 0) {
      return 'SNOW';
    }

    if ((rain ?? 0) > 0 || (precipitation ?? 0) >= 0.2) {
      return 'RAIN';
    }

    if ((cloudCover ?? 0) >= 60) {
      return 'CLOUDY';
    }

    return 'CLEAR';
  }
}
