import { Injectable } from '@nestjs/common';

import { createWorMapMvpApp } from '../core/create-wormap-app';

type BuildRequest = {
  sceneId: string;
  lat: number;
  lng: number;
  radius?: number;
};

@Injectable()
export class BuildGatewayService {
  private readonly app = createWorMapMvpApp();
  private latestGlbBytes: Uint8Array | null = null;
  private latestGlbSceneId: string | null = null;

  async build(request: BuildRequest) {
    const result = await this.app.services.osmSceneBuild.run({
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
      this.latestGlbBytes = result.glbArtifact.bytes;
      this.latestGlbSceneId = result.glbArtifact.sceneId;
    }

    return result;
  }

  getLatestGlb(): { bytes: Uint8Array; sceneId: string } | null {
    if (this.latestGlbBytes === null || this.latestGlbSceneId === null) {
      return null;
    }
    return {
      bytes: this.latestGlbBytes,
      sceneId: this.latestGlbSceneId,
    };
  }
}
