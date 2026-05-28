import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Body, Controller, Get, HttpCode, InternalServerErrorException, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import { BuildGatewayService } from './build.gateway.service';

type BuildRequestDto = {
  sceneId?: string;
  lat?: number;
  lng?: number;
  radius?: number;
};

@Controller()
export class BuildController {
  constructor(private readonly gateway: BuildGatewayService) {}

  @Get('/health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('/api')
  apiDocs() {
    return {
      name: 'WorMap v2 API',
      version: '2.0.0',
      endpoints: {
        '/health': 'Health check',
        '/api/build': 'POST - Build GLB from OSM data',
        '/api': 'GET - This documentation',
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
    };
  }

  @Post('/api/build')
  @HttpCode(200)
  async build(@Body() body: BuildRequestDto, @Res() res: Response) {
    const { sceneId, lat, lng, radius = 150 } = body;
    if (!sceneId || lat === undefined || lng === undefined) {
      res.status(400).json({ error: 'sceneId, lat, lng required' });
      return;
    }

    try {
      const result = await this.gateway.build({ sceneId, lat, lng, radius });

      if (result.kind === 'completed') {
        res.status(200).json({
          status: 'completed',
          artifactHash: result.glbArtifact.artifactHash,
          byteLength: result.glbArtifact.byteLength,
          meshSummary: result.glbArtifact.meshSummary,
          sceneId: result.glbArtifact.sceneId,
          downloadUrl: '/api/build/download',
        });
        return;
      }

      if (result.kind === 'glb_validation_failure') {
        res.status(422).json({
          status: 'validation_failed',
          issues: result.glbValidation.issues,
        });
        return;
      }

      res.status(422).json({
        status: result.kind,
        state: result.build.currentState(),
      });
    } catch (error) {
      throw new InternalServerErrorException({ error: String(error) });
    }
  }

  @Get('/api/build/download')
  async download(@Res() res: Response) {
    const latest = this.gateway.getLatestGlb();
    if (latest === null) {
      res.status(404).json({ error: 'No GLB built yet. POST /api/build first.' });
      return;
    }

    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Content-Disposition', `attachment; filename="${latest.sceneId}.glb"`);
    res.setHeader('Content-Length', latest.bytes.byteLength.toString());
    res.status(200).send(Buffer.from(latest.bytes));
  }

  @Get('/')
  root(@Res() res: Response) {
    const html = readFileSync(join(process.cwd(), 'src/spa.index.html'), 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  }

  @Get('/spa.js')
  spaScript(@Res() res: Response) {
    const script = readFileSync(join(process.cwd(), 'src/spa.js'), 'utf-8');
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.status(200).send(script);
  }
}
