import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import type { SceneScope } from '../shared/contracts';
import { OsmSceneBuildService } from '../providers/application';
import type { GlbArtifact } from '../pipeline/glb/application';
import { JobStoreService } from './job-store.service';

type BuildRequest = {
  sceneId: string;
  lat: number;
  lng: number;
  radius?: number;
  force?: boolean;
};

@Injectable()
export class BuildGatewayService {
  private readonly logger = new Logger(BuildGatewayService.name);
  private latestGlb: GlbArtifact | null = null;

  /**
   * Single-flight map: sceneId → jobId of an active (queued/building) job.
   * Prevents duplicate concurrent builds for the same scene.
   */
  private readonly activeBuilds = new Map<string, string>();

  constructor(
    private readonly osmSceneBuild: OsmSceneBuildService,
    private readonly jobStore: JobStoreService,
  ) {}

  // ---------------------------------------------------------------------------
  // Async build (non-blocking)
  // ---------------------------------------------------------------------------

  /** Creates a job and kicks off a build in the background. Returns jobId immediately. */
  enqueueBuild(request: BuildRequest): string {
    // Single-flight: if a build is already running for this sceneId, return that jobId.
    if (!request.force) {
      const existing = this.activeBuilds.get(request.sceneId);
      if (existing !== undefined) {
        this.logger.log(`Deduplicating build sceneId=${request.sceneId} → existing jobId=${existing}`);
        return existing;
      }
    }

    const jobId = `job:${request.sceneId}:${randomUUID()}`;
    this.activeBuilds.set(request.sceneId, jobId);
    this.jobStore.create(jobId, request.sceneId);
    // setImmediate defers execution to next event-loop tick — does not block HTTP response.
    setImmediate(() => void this.runBuild(jobId, request));
    this.logger.log(`Enqueued build jobId=${jobId} sceneId=${request.sceneId}`);
    return jobId;
  }

  private async runBuild(jobId: string, request: BuildRequest): Promise<void> {
    this.jobStore.markBuilding(jobId);

    try {
      // Check disk cache (skip rebuild if cached and force=false).
      if (!request.force) {
        const cached = await this.jobStore.readDiskCache(request.sceneId);
        if (cached !== null) {
          this.logger.log(`Cache hit sceneId=${request.sceneId} — serving from disk`);
          const artifact: GlbArtifact = {
            sceneId: request.sceneId,
            bytes: cached,
            byteLength: cached.byteLength,
            artifactHash: `cache:${request.sceneId}`,
            artifactRef: `cache:${request.sceneId}`,
            finalTier: 'PROCEDURAL_MODEL',
            qaSummary: {
              issueCount: 0, criticalCount: 0, majorCount: 0, minorCount: 0, infoCount: 0,
              warnActionCount: 0, recordActionCount: 0, failBuildCount: 0,
              downgradeTierCount: 0, stripDetailCount: 0, topCodes: [],
            },
            meshSummary: { nodeCount: 0, materialCount: 0, primitiveCounts: {} },
            gltfMetadata: {} as GlbArtifact['gltfMetadata'],
          };
          this.latestGlb = artifact;
          this.jobStore.markCompleted(jobId, artifact);
          this.activeBuilds.delete(request.sceneId);
          return;
        }
      }

      const result = await this.osmSceneBuild.run({
        sceneId: request.sceneId,
        buildId: `build:${request.sceneId}:${Date.now()}`,
        snapshotBundleId: `bundle:${request.sceneId}:${Date.now()}`,
        scope: this.makeRadiusScope(request.lat, request.lng, request.radius ?? 150),
      });

      if (result.kind === 'completed') {
        this.latestGlb = result.glbArtifact;
        this.jobStore.markCompleted(jobId, result.glbArtifact);
      } else {
        this.jobStore.markFailed(jobId, result.kind);
      }
    } catch (err) {
      this.logger.error(`Build failed jobId=${jobId}: ${err}`);
      this.jobStore.markFailed(jobId, String(err));
    } finally {
      // Remove from active builds regardless of outcome.
      this.activeBuilds.delete(request.sceneId);
    }
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  getLatestGlb(): GlbArtifact | null {
    return this.latestGlb;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

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
