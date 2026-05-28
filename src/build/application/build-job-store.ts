import { Injectable } from '@nestjs/common';

export const BUILD_JOB_STORE = Symbol('BUILD_JOB_STORE');

export type BuildJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type BuildJobSnapshot = {
  buildId: string;
  sceneId: string;
  status: BuildJobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
  artifactHash?: string;
  byteLength?: number;
};

export type BuildJobStore = {
  enqueue(input: { buildId: string; sceneId: string; createdAt?: string }): BuildJobSnapshot;
  markRunning(buildId: string, startedAt?: string): BuildJobSnapshot;
  markCompleted(
    buildId: string,
    input: { artifactHash?: string; byteLength?: number; finishedAt?: string },
  ): BuildJobSnapshot;
  markFailed(buildId: string, input: { errorMessage: string; finishedAt?: string }): BuildJobSnapshot;
  get(buildId: string): BuildJobSnapshot | undefined;
  listByScene(sceneId: string): BuildJobSnapshot[];
};

@Injectable()
export class InMemoryBuildJobStoreService implements BuildJobStore {
  private readonly jobs = new Map<string, BuildJobSnapshot>();

  enqueue(input: { buildId: string; sceneId: string; createdAt?: string }): BuildJobSnapshot {
    const now = input.createdAt ?? new Date().toISOString();
    const existing = this.jobs.get(input.buildId);
    if (existing !== undefined) {
      throw new Error(`Build job already exists: ${input.buildId}`);
    }

    const snapshot: BuildJobSnapshot = {
      buildId: input.buildId,
      sceneId: input.sceneId,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(input.buildId, snapshot);
    return snapshot;
  }

  markRunning(buildId: string, startedAt?: string): BuildJobSnapshot {
    const current = this.requireJob(buildId);
    if (current.status !== 'queued') {
      throw new Error(`Invalid build job transition: ${current.status} -> running (${buildId})`);
    }
    const now = startedAt ?? new Date().toISOString();
    const next: BuildJobSnapshot = {
      ...current,
      status: 'running',
      startedAt: now,
      updatedAt: now,
    };
    this.jobs.set(buildId, next);
    return next;
  }

  markCompleted(
    buildId: string,
    input: { artifactHash?: string; byteLength?: number; finishedAt?: string },
  ): BuildJobSnapshot {
    const current = this.requireJob(buildId);
    if (current.status !== 'running') {
      throw new Error(`Invalid build job transition: ${current.status} -> completed (${buildId})`);
    }
    const now = input.finishedAt ?? new Date().toISOString();
    const next: BuildJobSnapshot = {
      ...current,
      status: 'completed',
      finishedAt: now,
      updatedAt: now,
      artifactHash: input.artifactHash,
      byteLength: input.byteLength,
      errorMessage: undefined,
    };
    this.jobs.set(buildId, next);
    return next;
  }

  markFailed(buildId: string, input: { errorMessage: string; finishedAt?: string }): BuildJobSnapshot {
    const current = this.requireJob(buildId);
    if (current.status !== 'running' && current.status !== 'queued') {
      throw new Error(`Invalid build job transition: ${current.status} -> failed (${buildId})`);
    }
    const now = input.finishedAt ?? new Date().toISOString();
    const next: BuildJobSnapshot = {
      ...current,
      status: 'failed',
      finishedAt: now,
      updatedAt: now,
      errorMessage: input.errorMessage,
    };
    this.jobs.set(buildId, next);
    return next;
  }

  get(buildId: string): BuildJobSnapshot | undefined {
    return this.jobs.get(buildId);
  }

  listByScene(sceneId: string): BuildJobSnapshot[] {
    return [...this.jobs.values()]
      .filter((job) => job.sceneId === sceneId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  private requireJob(buildId: string): BuildJobSnapshot {
    const job = this.jobs.get(buildId);
    if (job === undefined) {
      throw new Error(`Build job not found: ${buildId}`);
    }
    return job;
  }
}
