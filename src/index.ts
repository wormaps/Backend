import { appModule } from './app.module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BunLogger } from '../packages/core/logger';

const logger = new BunLogger({ level: 'info', service: 'http' });

const PORT = parseInt(process.env.PORT ?? '8080', 10);

// Store the latest built GLB bytes for download
let latestGlbBytes: Uint8Array | null = null;
let latestGlbSceneId: string | null = null;

function serveHtml(): Response {
  return new Response(readFileSync(join(import.meta.dir, 'index.html'), 'utf-8'), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

const server = Bun.serve({
  port: PORT,
  routes: {
    '/health': {
      GET: () =>
        new Response(
          JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
    },

    '/api/build': {
      POST: async (req) => {
        try {
          const body = await req.json() as { sceneId?: string; lat?: number; lng?: number; radius?: number };
          const { sceneId, lat, lng, radius = 150 } = body;

          logger.info('Received build request', {
            sceneId: sceneId ?? '',
            lat: lat ?? 0,
            lng: lng ?? 0,
            radius,
          });

          if (!sceneId || lat === undefined || lng === undefined) {
            return new Response(JSON.stringify({ error: 'sceneId, lat, lng required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          const result = await appModule.services.osmSceneBuild.run({
            sceneId,
            buildId: `build:${sceneId}:${Date.now()}`,
            snapshotBundleId: `bundle:${sceneId}:${Date.now()}`,
            scope: {
              center: { lat, lng },
              boundaryType: 'radius',
              radiusMeters: radius,
              coreArea: { outer: [] },
              contextArea: { outer: [] },
            },
          });

          if (result.kind === 'completed') {
            latestGlbBytes = result.glbArtifact.bytes;
            latestGlbSceneId = result.glbArtifact.sceneId;
            logger.info('Build request completed', {
              sceneId: result.glbArtifact.sceneId,
              byteLength: result.glbArtifact.byteLength,
              nodeCount: result.glbArtifact.meshSummary.nodeCount,
            });
            return new Response(
              JSON.stringify({
                status: 'completed',
                artifactHash: result.glbArtifact.artifactHash,
                byteLength: result.glbArtifact.byteLength,
                meshSummary: result.glbArtifact.meshSummary,
                sceneId: result.glbArtifact.sceneId,
                downloadUrl: `/api/build/download`,
              }),
              { headers: { 'Content-Type': 'application/json' } },
            );
          }

          if (result.kind === 'glb_validation_failure') {
            logger.warn('Build request validation failed', {
              sceneId,
              issueCount: result.glbValidation.issues.length,
            });
            return new Response(
              JSON.stringify({
                status: 'validation_failed',
                issues: result.glbValidation.issues,
              }),
              { status: 422, headers: { 'Content-Type': 'application/json' } },
            );
          }

          return new Response(
            JSON.stringify({
              status: result.kind,
              state: result.build.currentState(),
            }),
            { status: 422, headers: { 'Content-Type': 'application/json' } },
          );
        } catch (error) {
          logger.error('Build request failed with exception', {
            error: String(error),
          });
          return new Response(JSON.stringify({ error: String(error) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },

    '/api/build/download': {
      GET: () => {
        if (!latestGlbBytes) {
          return new Response(JSON.stringify({ error: 'No GLB built yet. POST /api/build first.' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(latestGlbBytes, {
          headers: {
            'Content-Type': 'model/gltf-binary',
            'Content-Disposition': `attachment; filename="${latestGlbSceneId ?? 'scene'}.glb"`,
            'Content-Length': latestGlbBytes.byteLength.toString(),
          },
        });
      },
    },

    '/api': {
      GET: () =>
        new Response(
          JSON.stringify(
            {
              name: 'WorMap v2 API',
              version: '2.0.0',
              endpoints: {
                '/health': 'Health check',
                '/api/build': 'POST - Build GLB from OSM data',
                '/api': 'GET - This documentation',
                '/': 'GET - Test page',
              },
              buildEndpoint: {
                method: 'POST',
                path: '/api/build',
                body: {
                  sceneId: 'string (required)',
                  lat: 'number (required)',
                  lng: 'number (required)',
                  radius: 'number (optional, default 150)',
                },
                response: {
                  status: '"completed" | "validation_failed" | "snapshot_failure" | "quarantined"',
                  artifactHash: 'string (sha256:)',
                  byteLength: 'number',
                  meshSummary: '{ nodeCount, materialCount, primitiveCounts }',
                },
              },
            },
            null,
            2,
          ),
          { headers: { 'Content-Type': 'application/json' } },
        ),
    },

    '/': {
      GET: () => serveHtml(),
    },
  },
});

logger.info(`WorMap v2 server running at http://localhost:${PORT}`);
logger.info(`API docs at http://localhost:${PORT}/api`);
logger.info(`Test page at http://localhost:${PORT}/`);
