import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  Body, Controller, Get, HttpCode, NotFoundException,
  Param, Post, Res,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import type { Response } from 'express';

import { BuildGatewayService } from './build.gateway.service';
import { JobStoreService, safeFileName } from './job-store.service';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

class BuildRequestDto {
  @ApiProperty({ description: 'Unique identifier for the scene' })
  @IsString()
  sceneId!: string;

  @ApiProperty({ description: 'Latitude of the scene centre', minimum: -90, maximum: 90 })
  @IsNumber()
  @Min(-90) @Max(90)
  lat!: number;

  @ApiProperty({ description: 'Longitude of the scene centre', minimum: -180, maximum: 180 })
  @IsNumber()
  @Min(-180) @Max(180)
  lng!: number;

  @ApiProperty({ description: 'Radius in metres', default: 150, required: false })
  @IsOptional()
  @IsNumber()
  @Min(10) @Max(5000)
  radius?: number;

  @ApiProperty({ description: 'Force rebuild even if cached GLB exists', required: false })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@ApiTags('build')
@Controller()
export class BuildController {
  constructor(
    private readonly gateway: BuildGatewayService,
    private readonly jobStore: JobStoreService,
  ) {}

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------

  @Get('/health')
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200 })
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  // -------------------------------------------------------------------------
  // Build (async)
  // -------------------------------------------------------------------------

  @Post('/api/build')
  @HttpCode(202)
  @ApiOperation({ summary: 'Enqueue a GLB build and return a job ID immediately' })
  @ApiBody({ type: BuildRequestDto })
  @ApiResponse({
    status: 202,
    description: 'Job accepted. Poll GET /api/jobs/:jobId for status.',
  })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  async build(@Body() body: BuildRequestDto, @Res() res: Response) {
    const { sceneId, lat, lng, radius = 150, force = false } = body;
    if (!sceneId || lat === undefined || lng === undefined) {
      res.status(400).json({ error: 'sceneId, lat, lng required' });
      return;
    }

    const jobId = this.gateway.enqueueBuild({ sceneId, lat, lng, radius, force });

    res.status(202).json({
      jobId,
      status: 'queued',
      statusUrl: `/api/jobs/${jobId}`,
      downloadUrl: `/api/jobs/${jobId}/download`,
    });
  }

  // -------------------------------------------------------------------------
  // Jobs
  // -------------------------------------------------------------------------

  @Get('/api/jobs')
  @ApiOperation({ summary: 'List recent build jobs (last 50)' })
  @ApiResponse({ status: 200 })
  listJobs() {
    return this.jobStore.list();
  }

  @Get('/api/jobs/:jobId')
  @ApiOperation({ summary: 'Get status of a specific build job' })
  @ApiParam({ name: 'jobId', description: 'Job ID returned by POST /api/build' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  getJob(@Param('jobId') jobId: string) {
    const job = this.jobStore.getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    return job;
  }

  @Get('/api/jobs/:jobId/download')
  @ApiOperation({ summary: 'Download GLB for a completed job' })
  @ApiParam({ name: 'jobId' })
  @ApiResponse({ status: 200, description: 'GLB binary (model/gltf-binary)' })
  @ApiResponse({ status: 404 })
  downloadJob(@Param('jobId') jobId: string, @Res() res: Response) {
    const job = this.jobStore.getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    if (job.status !== 'completed') {
      res.status(409).json({ error: `Job status is '${job.status}', not 'completed'` });
      return;
    }
    const bytes = this.jobStore.getBytes(jobId);
    if (!bytes) {
      res.status(404).json({ error: 'Bytes not available (may have been evicted from memory)' });
      return;
    }
    const safeName = safeFileName(job.sceneId);
    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.glb"`);
    res.setHeader('Content-Length', bytes.byteLength.toString());
    res.status(200).send(Buffer.from(bytes));
  }

  // -------------------------------------------------------------------------
  // Scene cache
  // -------------------------------------------------------------------------

  @Get('/api/scenes/:sceneId/download')
  @ApiOperation({ summary: 'Download cached GLB for a scene directly (no job required)' })
  @ApiParam({ name: 'sceneId' })
  @ApiResponse({ status: 200, description: 'GLB binary (model/gltf-binary)' })
  @ApiResponse({ status: 404 })
  async downloadScene(@Param('sceneId') sceneId: string, @Res() res: Response) {
    const cached = await this.jobStore.readDiskCache(sceneId);
    if (!cached) {
      res.status(404).json({ error: `No cached GLB for sceneId=${sceneId}. POST /api/build first.` });
      return;
    }
    const safeName = safeFileName(sceneId);
    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.glb"`);
    res.setHeader('Content-Length', cached.byteLength.toString());
    res.status(200).send(Buffer.from(cached));
  }

  // -------------------------------------------------------------------------
  // Legacy download (backward compat)
  // -------------------------------------------------------------------------

  @Get('/api/build/download')
  @ApiOperation({ summary: '[Legacy] Download the most recently completed GLB' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  downloadLatest(@Res() res: Response) {
    const latest = this.gateway.getLatestGlb();
    if (latest === null) {
      res.status(404).json({ error: 'No GLB built yet. POST /api/build first.' });
      return;
    }
    const safeName = safeFileName(latest.sceneId);
    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.glb"`);
    res.setHeader('Content-Length', latest.bytes.byteLength.toString());
    res.status(200).send(Buffer.from(latest.bytes));
  }

  // -------------------------------------------------------------------------
  // SPA
  // -------------------------------------------------------------------------

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
