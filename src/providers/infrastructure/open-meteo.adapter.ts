export type OpenMeteoResponse = {
  latitude: number;
  longitude: number;
  hourly?: {
    time: string[];
    temperature_2m?: number[];
    precipitation?: number[];
    precipitation_probability?: number[];
    visibility?: number[];
    cloud_cover?: number[];
  };
  daily?: {
    time: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
  };
};

export type WeatherData = {
  provider: 'open_meteo';
  sceneId: string;
  temperature: { min: number | undefined; max: number | undefined; avg: number | undefined };
  precipitation: number | undefined;
  visibility: number | undefined;
  cloudCover: number | undefined;
};

const safeAvg = (values: number[]): number | undefined =>
  values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : undefined;

const safeMin = (values: number[]): number | undefined => (values.length > 0 ? Math.min(...values) : undefined);

const safeMax = (values: number[]): number | undefined => (values.length > 0 ? Math.max(...values) : undefined);

const sumOrUndefined = (values: number[]): number | undefined =>
  values.length === 0 ? undefined : values.reduce((total, value) => total + value, 0);

export class OpenMeteoAdapter {
  constructor(private readonly baseUrl: string = 'https://archive-api.open-meteo.com/v1') {}

  async queryWeather(lat: number, lng: number, startDate?: string): Promise<WeatherData> {
    const date = startDate ?? new Date().toISOString().split('T')[0]!;
    const params = new URLSearchParams();
    params.set('latitude', lat.toString());
    params.set('longitude', lng.toString());
    params.set('start_date', date);
    params.set('end_date', date);
    params.set('hourly', 'temperature_2m,precipitation,precipitation_probability,visibility,cloud_cover');
    params.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum');
    params.set('timezone', 'auto');

    const response = await fetch(`${this.baseUrl}/archive?${params}`);
    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status}`);
    }

    const data = (await response.json()) as OpenMeteoResponse;

    const temps = data.hourly?.temperature_2m ?? [];
    const precip = data.hourly?.precipitation ?? [];
    const vis = data.hourly?.visibility ?? [];
    const cloud = data.hourly?.cloud_cover ?? [];

    return {
      provider: 'open_meteo',
      sceneId: `${lat},${lng}`,
      temperature: {
        min: safeMin(temps),
        max: safeMax(temps),
        avg: safeAvg(temps),
      },
      precipitation: sumOrUndefined(precip),
      visibility: safeAvg(vis),
      cloudCover: safeAvg(cloud),
    };
  }
}
