import { Injectable } from '@nestjs/common';

import { OsmSceneBuildService } from '../providers/application';
import type { GlbArtifact } from '../pipeline/glb/application';
import type { SceneBuildRunResult } from '../build/application';
import type { SceneScope } from '../shared/contracts';

type BuildRequest = {
  sceneId: string;
  lat: number;
  lng: number;
  radius?: number;
};

@Injectable()
export class BuildGatewayService {
  private latestGlb: GlbArtifact | null = null;

  constructor(private readonly osmSceneBuild: OsmSceneBuildService) {}

  async build(request: BuildRequest): Promise<SceneBuildRunResult> {
    const result = await this.osmSceneBuild.run({
      sceneId: request.sceneId,
      buildId: `build:${request.sceneId}:${Date.now()}`,
      snapshotBundleId: `bundle:${request.sceneId}:${Date.now()}`,
      scope: this.makeRadiusScope(request.lat, request.lng, request.radius ?? 150),
    });

    if (result.kind === 'completed') {
      this.latestGlb = result.glbArtifact;
    }

    return result;
  }

  getLatestGlb(): GlbArtifact | null {
    return this.latestGlb;
  }

  private makeRadiusScope(lat: number, lng: number, radiusMeters: number): SceneScope {
    const earthRadius = 6_371_000;
    const latDelta = (radiusMeters / earthRadius) * (180 / Math.PI);
    const lngDelta = (radiusMeters / (earthRadius * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);

    const outer = [
      { lat: lat + latDelta, lng: lng - lngDelta },
      { lat: lat + latDelta, lng: lng + lngDelta },
      { lat: lat - latDelta, lng: lng + lngDelta },
      { lat: lat - latDelta, lng: lng - lngDelta },
    ];

    const contextScale = 1.5;
    const contextLatDelta = latDelta * contextScale;
    const contextLngDelta = lngDelta * contextScale;
    const contextOuter = [
      { lat: lat + contextLatDelta, lng: lng - contextLngDelta },
      { lat: lat + contextLatDelta, lng: lng + contextLngDelta },
      { lat: lat - contextLatDelta, lng: lng + contextLngDelta },
      { lat: lat - contextLatDelta, lng: lng - contextLngDelta },
    ];

    return {
      center: { lat, lng },
      boundaryType: 'radius',
      radiusMeters,
      coreArea: { outer },
      contextArea: { outer: contextOuter },
    };
  }
}
