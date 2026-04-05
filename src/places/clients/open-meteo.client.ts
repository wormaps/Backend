import { Injectable } from '@nestjs/common';
import { fetchJson } from '../../common/http/fetch-json';
import type { FetchLike } from '../../common/http/fetch-json';
import {
  ExternalPlaceDetail,
  WeatherObservation,
} from '../types/external-place.types';
import { TimeOfDay, WeatherType } from '../types/place.types';

interface OpenMeteoResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    precipitation?: number;
    rain?: number;
    snowfall?: number;
    cloud_cover?: number;
  };
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

  async getObservation(
    place: ExternalPlaceDetail,
    date: string,
    timeOfDay: TimeOfDay,
  ): Promise<WeatherObservation | null> {
    if (this.isTodayForPlace(place, date)) {
      const current = await this.getCurrentObservation(place);
      if (current) {
        return current;
      }
    }

    return this.getHistoricalObservation(place, date, timeOfDay);
  }

  async getCurrentObservation(
    place: ExternalPlaceDetail,
  ): Promise<WeatherObservation | null> {
    const response = await fetchJson<OpenMeteoResponse>(
      {
        provider: 'Open-Meteo Current Weather',
        url:
          `https://api.open-meteo.com/v1/forecast?latitude=${place.location.lat}` +
          `&longitude=${place.location.lng}` +
          '&current=temperature_2m,precipitation,rain,snowfall,cloud_cover' +
          '&timezone=auto',
      },
      this.fetcher,
    );

    const current = response.current;
    if (!current?.time) {
      return null;
    }

    const rain = current.rain ?? null;
    const snowfall = current.snowfall ?? null;
    const precipitation = current.precipitation ?? null;
    const cloudCover = current.cloud_cover ?? null;

    return {
      date: current.time.slice(0, 10),
      localTime: current.time,
      temperatureCelsius: current.temperature_2m ?? null,
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
      source: 'OPEN_METEO_CURRENT',
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

  private isTodayForPlace(place: ExternalPlaceDetail, date: string): boolean {
    const now = new Date();
    const offsetMinutes = place.utcOffsetMinutes;
    if (offsetMinutes === null) {
      return date === now.toISOString().slice(0, 10);
    }

    const shifted = new Date(now.getTime() + offsetMinutes * 60 * 1000);
    const year = shifted.getUTCFullYear();
    const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const day = String(shifted.getUTCDate()).padStart(2, '0');
    return date === `${year}-${month}-${day}`;
  }
}
