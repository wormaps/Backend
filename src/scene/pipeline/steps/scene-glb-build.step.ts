import { Injectable } from '@nestjs/common';
import { GlbBuilderService } from '../../../assets/glb-builder.service';
import type { SceneDetail, SceneMeta } from '../../types/scene.types';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { readFile } from 'node:fs/promises';
import {
  appendSceneDiagnosticsLog,
  getSceneDiagnosticsLogPath,
} from '../../storage/scene-storage.utils';

interface BuildingClosureDiagnosticsShape {
  openShellCount?: number;
  roofWallGapCount?: number;
  invalidSetbackJoinCount?: number;
}

@Injectable()
export class SceneGlbBuildStep {
  constructor(
    private readonly glbBuilderService: GlbBuilderService,
    private readonly appLoggerService: AppLoggerService,
  ) {}

  async execute(
    meta: SceneMeta,
    detail: SceneDetail,
    runMetrics?: {
      pipelineMs?: number;
    },
  ): Promise<string> {
    this.appLoggerService.info('scene.glb_build.static_atmosphere', {
      sceneId: meta.sceneId,
      step: 'glb_build',
      staticAtmosphere: detail.staticAtmosphere?.preset ?? 'DAY_CLEAR',
      emissiveBoost: detail.staticAtmosphere?.emissiveBoost ?? 1,
      roadRoughnessScale: detail.staticAtmosphere?.roadRoughnessScale ?? 1,
      wetRoadBoost: detail.staticAtmosphere?.wetRoadBoost ?? 0,
    });

    const assetPath = await this.glbBuilderService.build(
      meta,
      detail,
      runMetrics,
    );

    const closureDiagnostics = await this.resolveBuildingClosureDiagnostics(
      meta.sceneId,
    );
    if (closureDiagnostics) {
      const geometryDiagnostics = detail.geometryDiagnostics ?? [];
      const markerIndex = geometryDiagnostics.findIndex(
        (entry) => entry.objectId === '__geometry_correction__',
      );
      if (markerIndex >= 0) {
        const existingMarker = geometryDiagnostics[markerIndex];
        const mergedMarker = {
          ...existingMarker,
          openShellCount:
            closureDiagnostics.openShellCount ?? existingMarker.openShellCount,
          roofWallGapCount:
            closureDiagnostics.roofWallGapCount ??
            existingMarker.roofWallGapCount,
          invalidSetbackJoinCount:
            closureDiagnostics.invalidSetbackJoinCount ??
            existingMarker.invalidSetbackJoinCount,
        };
        geometryDiagnostics[markerIndex] = {
          ...mergedMarker,
        };
        detail.geometryDiagnostics = geometryDiagnostics;

        await appendSceneDiagnosticsLog(
          meta.sceneId,
          'geometry_correction_merge',
          {
            markerBeforeMerge: {
              openShellCount: existingMarker.openShellCount,
              roofWallGapCount: existingMarker.roofWallGapCount,
              invalidSetbackJoinCount: existingMarker.invalidSetbackJoinCount,
            },
            markerFromGlbBuild: closureDiagnostics,
            markerAfterMerge: {
              openShellCount: mergedMarker.openShellCount,
              roofWallGapCount: mergedMarker.roofWallGapCount,
              invalidSetbackJoinCount: mergedMarker.invalidSetbackJoinCount,
            },
          },
        );
      }
    }

    return assetPath;
  }

  private async resolveBuildingClosureDiagnostics(
    sceneId: string,
  ): Promise<BuildingClosureDiagnosticsShape | null> {
    let raw = '';
    try {
      raw = await readFile(getSceneDiagnosticsLogPath(sceneId), 'utf8');
    } catch {
      return null;
    }

    const entries = raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        try {
          return JSON.parse(line) as {
            stage?: string;
            buildingClosureDiagnostics?: BuildingClosureDiagnosticsShape;
          };
        } catch {
          return null;
        }
      })
      .filter(
        (
          entry,
        ): entry is {
          stage?: string;
          buildingClosureDiagnostics?: BuildingClosureDiagnosticsShape;
        } => Boolean(entry),
      )
      .filter((entry) => entry.stage === 'glb_build');

    const latest = entries.at(-1);
    return latest?.buildingClosureDiagnostics ?? null;
  }
}
