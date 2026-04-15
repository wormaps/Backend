import { Injectable } from '@nestjs/common';
import type { SceneDetail } from '../../types/scene.types';

export interface CuratedAssetPayload {
  landmarks?: Array<{ id: string; name: string }>;
  facadeOverrides?: Array<{ objectId: string; palette: string[] }>;
  signageOverrides?: Array<{ objectId: string; panelCount: number }>;
}

export interface CuratedSourceReadinessResult {
  ready: boolean;
  reason: string;
  payload?: CuratedAssetPayload;
  evidenceScore: number;
}

@Injectable()
export class CuratedAssetResolverService {
  resolveReadiness(
    detail: SceneDetail,
    curatedPayload?: CuratedAssetPayload,
  ): CuratedSourceReadinessResult {
    if (!curatedPayload) {
      return {
        ready: false,
        reason: 'No curated asset payload provided',
        evidenceScore: 0,
      };
    }

    const landmarkCount = curatedPayload.landmarks?.length ?? 0;
    const facadeOverrideCount = curatedPayload.facadeOverrides?.length ?? 0;
    const signageOverrideCount = curatedPayload.signageOverrides?.length ?? 0;

    const hasMinimumLandmarks = landmarkCount >= 2;
    const hasFacadeOverrides = facadeOverrideCount >= 1;
    const hasSignageOverrides = signageOverrideCount >= 1;

    const evidenceScore = this.calculateEvidenceScore(
      landmarkCount,
      facadeOverrideCount,
      signageOverrideCount,
      detail,
    );

    if (!hasMinimumLandmarks) {
      return {
        ready: false,
        reason: `Insufficient curated landmarks: ${landmarkCount} provided, minimum 2 required`,
        payload: curatedPayload,
        evidenceScore,
      };
    }

    if (!hasFacadeOverrides && !hasSignageOverrides) {
      return {
        ready: false,
        reason: 'No facade or signage overrides in curated payload',
        payload: curatedPayload,
        evidenceScore,
      };
    }

    return {
      ready: true,
      reason: `Curated asset pack ready: ${landmarkCount} landmarks, ${facadeOverrideCount} facade overrides, ${signageOverrideCount} signage overrides`,
      payload: curatedPayload,
      evidenceScore,
    };
  }

  private calculateEvidenceScore(
    landmarkCount: number,
    facadeOverrideCount: number,
    signageOverrideCount: number,
    detail: SceneDetail,
  ): number {
    const landmarkScore = Math.min(1, landmarkCount / 3) * 40;
    const facadeScore = Math.min(1, facadeOverrideCount / 2) * 30;
    const signageScore = Math.min(1, signageOverrideCount / 2) * 20;
    const annotationScore =
      Math.min(1, detail.annotationsApplied.length / 3) * 10;

    return Math.round(
      landmarkScore + facadeScore + signageScore + annotationScore,
    );
  }
}
