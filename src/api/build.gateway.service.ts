import { Injectable } from '@nestjs/common';

import { OsmSceneBuildService } from '../providers/application/osm-scene-build.service';
import type { GlbArtifact } from '../pipeline/glb/application/glb-compiler.service';
import type { SceneBuildRunResult } from '../build/application/scene-build-run-result';

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
      scope: {
        center: { lat: request.lat, lng: request.lng },
        boundaryType: 'radius',
        radiusMeters: request.radius ?? 150,
        coreArea: { outer: [] },
        contextArea: { outer: [] },
      },
    });

    if (result.kind === 'completed') {
      this.latestGlb = result.glbArtifact;
    }

    return result;
  }

  getLatestGlb(): GlbArtifact | null {
    return this.latestGlb;
  }
}
