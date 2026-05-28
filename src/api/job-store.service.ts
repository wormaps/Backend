import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import type { GlbArtifact } from '../pipeline/glb/application';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BuildJobStatus = 'queued' | 'building' | 'completed' | 'failed';

export type BuildJob = {
  jobId: string;
  sceneId: string;
  status: BuildJobStatus;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  /** Present only when status === 'completed'. bytes field omitted (large). */
  artifactMeta?: {
    artifactHash: string;
    byteLength: number;
    meshSummary: GlbArtifact['meshSummary'];
  };
  error?: string;
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Max jobs kept in memory before evicting oldest completed/failed entries. */
const MAX_JOBS = 100;
/** Keep bytes in memory for 10 minutes after completion, then evict. */
const BYTES_TTL_MS = 10 * 60 * 1_000;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class JobStoreService {
  private readonly logger = new Logger(JobStoreService.name);
  private readonly jobs = new Map<string, BuildJob>();
  /** Keeps GLB bytes in memory for BYTES_TTL_MS after completion. */
  private readonly bytesCache = new Map<string, { bytes: Uint8Array; expiresAt: number }>();
  private readonly sceneDir: string;

  constructor() {
    this.sceneDir = process.env.SCENE_DATA_DIR ?? 'data/scene';
    void mkdir(this.sceneDir, { recursive: true });
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  create(jobId: string, sceneId: string): BuildJob {
    const job: BuildJob = {
      jobId,
      sceneId,
      status: 'queued',
      queuedAt: new Date().toISOString(),
    };
    this.jobs.set(jobId, job);
    this.evictOldJobs();
    return job;
  }

  markBuilding(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'building';
    job.startedAt = new Date().toISOString();
  }

  markCompleted(jobId: string, artifact: GlbArtifact): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.artifactMeta = {
      artifactHash: artifact.artifactHash,
      byteLength: artifact.byteLength,
      meshSummary: artifact.meshSummary,
    };
    // Store bytes in memory with TTL.
    this.bytesCache.set(jobId, {
      bytes: artifact.bytes,
      expiresAt: Date.now() + BYTES_TTL_MS,
    });
    // Persist to disk async (non-blocking).
    void this.writeToDisk(job.sceneId, artifact.bytes);
  }

  markFailed(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'failed';
    job.completedAt = new Date().toISOString();
    job.error = error;
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  getJob(jobId: string): BuildJob | undefined {
    return this.jobs.get(jobId);
  }

  getBytes(jobId: string): Uint8Array | undefined {
    const entry = this.bytesCache.get(jobId);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.bytesCache.delete(jobId);
      return undefined;
    }
    return entry.bytes;
  }

  list(): BuildJob[] {
    return [...this.jobs.values()]
      .sort((a, b) => b.queuedAt.localeCompare(a.queuedAt))
      .slice(0, 50);
  }

  // -------------------------------------------------------------------------
  // Disk cache (async)
  // -------------------------------------------------------------------------

  /** Returns cached GLB bytes for sceneId from disk, null if not found. */
  async readDiskCache(sceneId: string): Promise<Uint8Array | null> {
    const path = this.scenePath(sceneId);
    if (!existsSync(path)) return null;
    try {
      return await readFile(path);
    } catch {
      return null;
    }
  }

  private async writeToDisk(sceneId: string, bytes: Uint8Array): Promise<void> {
    try {
      await writeFile(this.scenePath(sceneId), bytes);
      this.logger.log(`Cached GLB to disk sceneId=${sceneId}`);
    } catch (err) {
      this.logger.warn(`Disk cache write failed: ${err}`);
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private scenePath(sceneId: string): string {
    return join(this.sceneDir, `${safeFileName(sceneId)}.glb`);
  }

  /** Evict oldest completed/failed jobs when over MAX_JOBS. Queued/building stay. */
  private evictOldJobs(): void {
    if (this.jobs.size <= MAX_JOBS) return;
    const evictable = [...this.jobs.values()]
      .filter((j) => j.status === 'completed' || j.status === 'failed')
      .sort((a, b) => (a.completedAt ?? a.queuedAt).localeCompare(b.completedAt ?? b.queuedAt));
    const toRemove = this.jobs.size - MAX_JOBS;
    for (let i = 0; i < toRemove && i < evictable.length; i++) {
      const job = evictable[i]!;
      this.jobs.delete(job.jobId);
      this.bytesCache.delete(job.jobId);
    }
  }
}

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

/** Sanitise sceneId for use as a filename. Whitelist: alphanumeric, dash, underscore. */
export function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}
