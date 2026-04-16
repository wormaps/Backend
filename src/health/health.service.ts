import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface LivenessResult {
  status: 'ok';
  uptimeSeconds: number;
}

interface ReadinessChecks {
  googlePlaces: boolean;
  overpass: boolean;
  mapillary: boolean;
  tomtom: boolean;
}

interface ReadinessResult {
  status: 'ok' | 'degraded';
  checks: ReadinessChecks;
}

@Injectable()
export class HealthService {
  constructor(private readonly configService: ConfigService) {}

  checkLiveness(): LivenessResult {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  async checkReadiness(): Promise<ReadinessResult> {
    const [googlePlaces, overpass, mapillary, tomtom] = await Promise.all([
      this.checkGooglePlaces(),
      this.checkOverpass(),
      this.checkMapillary(),
      this.checkTomTom(),
    ]);

    const checks: ReadinessChecks = {
      googlePlaces,
      overpass,
      mapillary,
      tomtom,
    };

    const allHealthy = Object.values(checks).every(Boolean);

    return {
      status: allHealthy ? 'ok' : 'degraded',
      checks,
    };
  }

  private async checkGooglePlaces(): Promise<boolean> {
    const apiKey = this.configService.get<string>('GOOGLE_API_KEY')?.trim();
    if (!apiKey) {
      return false;
    }

    return this.probe(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id',
        },
        body: JSON.stringify({
          textQuery: 'Seoul',
          pageSize: 1,
          languageCode: 'en',
        }),
      },
    );
  }

  private async checkOverpass(): Promise<boolean> {
    const rawUrls = this.configService.get<string>('OVERPASS_API_URLS')?.trim();
    if (!rawUrls) {
      return false;
    }

    const firstUrl = rawUrls
      .split(',')
      .map((value) => value.trim())
      .find(Boolean);
    if (!firstUrl) {
      return false;
    }

    return this.probe(firstUrl, {
      method: 'HEAD',
    });
  }

  private async checkMapillary(): Promise<boolean> {
    const accessToken = this.configService
      .get<string>('MAPILLARY_ACCESS_TOKEN')
      ?.trim();
    if (!accessToken) {
      return true;
    }

    return this.probe(
      `https://graph.mapillary.com/images?access_token=${encodeURIComponent(accessToken)}&bbox=127.027,37.497,127.028,37.498&fields=id&limit=1`,
      {
        method: 'GET',
      },
    );
  }

  private async checkTomTom(): Promise<boolean> {
    const apiKey = this.configService.get<string>('TOMTOM_API_KEY')?.trim();
    if (!apiKey) {
      return false;
    }

    return this.probe(
      'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=37.4979,127.0276',
      {
        method: 'GET',
        headers: {
          'X-TomTom-Api-Key': apiKey,
        },
      },
    );
  }

  private async probe(url: string, init: RequestInit): Promise<boolean> {
    try {
      await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(2500),
      });
      return true;
    } catch {
      return false;
    }
  }
}
