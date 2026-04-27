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
  temperature: { min: number; max: number; avg: number };
  precipitation: number;
  visibility: number;
  cloudCover: number;
};

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
        min: Math.min(...temps.filter((t) => t !== undefined)),
        max: Math.max(...temps.filter((t) => t !== undefined)),
        avg: temps.reduce((a, b) => a + b, 0) / (temps.length || 1),
      },
      precipitation: precip.reduce((a, b) => a + b, 0),
      visibility: vis.reduce((a, b) => a + b, 0) / (vis.length || 1),
      cloudCover: cloud.reduce((a, b) => a + b, 0) / (cloud.length || 1),
    };
  }
}
