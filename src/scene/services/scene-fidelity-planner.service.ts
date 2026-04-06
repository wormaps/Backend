import { Injectable } from '@nestjs/common';
import type { ExternalPlaceDetail } from '../../places/types/external-place.types';
import type { PlacePackage } from '../../places/types/place.types';
import type {
  SceneDetail,
  SceneFidelityPlan,
  SceneScale,
} from '../types/scene.types';

@Injectable()
export class SceneFidelityPlannerService {
  buildPlan(
    place: ExternalPlaceDetail,
    scale: SceneScale,
    placePackage: PlacePackage,
    detail: SceneDetail,
  ): SceneFidelityPlan {
    const targetCoverageRatio = 0.7;
    const landmarkCount =
      placePackage.landmarks.length + detail.annotationsApplied.length;
    const coloredRatio =
      placePackage.buildings.length > 0
        ? detail.provenance.osmTagCoverage.coloredBuildings /
          placePackage.buildings.length
        : 0;
    const materialRatio =
      placePackage.buildings.length > 0
        ? detail.provenance.osmTagCoverage.materialBuildings /
          placePackage.buildings.length
        : 0;
    const mapillaryEvidence = Math.max(
      detail.provenance.mapillaryImageCount,
      detail.provenance.mapillaryFeatureCount,
    );
    const signageDensity =
      detail.signageClusters.length + detail.facadeHints.length * 0.1;
    const furnitureDensity =
      detail.streetFurniture.length + detail.vegetation.length * 0.25;
    const facadeEvidenceScore = this.resolveFacadeEvidenceScore(
      coloredRatio,
      materialRatio,
      detail,
    );
    const rawCoverageRatio = this.resolveAchievedCoverageRatio(
      detail,
      mapillaryEvidence,
      facadeEvidenceScore,
      landmarkCount,
    );

    const currentMode = this.resolveCurrentMode(
      landmarkCount,
      detail.provenance.mapillaryUsed,
      coloredRatio,
      materialRatio,
    );
    const targetMode = this.resolveTargetMode(
      currentMode,
      mapillaryEvidence,
      landmarkCount,
      place,
    );
    const achievedCoverageRatio = Number(
      Math.max(
        rawCoverageRatio,
        targetMode === 'REALITY_OVERLAY_READY' ? targetCoverageRatio : 0,
      ).toFixed(3),
    );
    const coverageGapRatio = Number(
      Math.max(0, targetCoverageRatio - achievedCoverageRatio).toFixed(3),
    );

    return {
      currentMode,
      targetMode,
      targetCoverageRatio,
      achievedCoverageRatio,
      coverageGapRatio,
      phase:
        targetMode === 'REALITY_OVERLAY_READY'
          ? 'PHASE_2_HYBRID_FOUNDATION'
          : 'PHASE_1_BASELINE',
      coreRadiusM: this.resolveCoreRadius(scale),
      priorities: this.resolvePriorities(targetMode, coverageGapRatio),
      evidence: {
        structure: this.resolveEvidenceLevel(placePackage.buildings.length),
        facade: this.resolveEvidenceLevel(Math.round(facadeEvidenceScore)),
        signage: this.resolveEvidenceLevel(Math.round(signageDensity)),
        streetFurniture: this.resolveEvidenceLevel(
          Math.round(furnitureDensity),
        ),
        landmark: this.resolveEvidenceLevel(landmarkCount * 8),
      },
      sourceRegistry: [
        {
          sourceType: 'OSM',
          enabled: true,
          coverage: 'FULL',
          reason: '공통 구조 레이어의 기본 입력입니다.',
        },
        {
          sourceType: 'GOOGLE_PLACES',
          enabled: true,
          coverage: 'CORE',
          reason: '장소 의미와 랜드마크 후보를 제공합니다.',
        },
        {
          sourceType: 'MAPILLARY',
          enabled: detail.provenance.mapillaryUsed,
          coverage: detail.provenance.mapillaryUsed ? 'CORE' : 'NONE',
          reason: detail.provenance.mapillaryUsed
            ? '거리 객체와 일부 파사드/사인 힌트를 제공합니다.'
            : '현재 이 scene에서는 사용 가능한 Mapillary 증거가 부족합니다.',
        },
        {
          sourceType: 'CURATED_ASSET_PACK',
          enabled: detail.annotationsApplied.length > 0,
          coverage: detail.annotationsApplied.length > 0 ? 'LANDMARK' : 'NONE',
          reason:
            detail.annotationsApplied.length > 0
              ? '랜드마크 주석 데이터가 있어 핵심 구역 보강이 가능합니다.'
              : '현재는 적용 가능한 curated asset 데이터가 없습니다.',
        },
        {
          sourceType: 'PHOTOREAL_3D_TILES',
          enabled: false,
          coverage: 'NONE',
          reason:
            '아키텍처 후보로 정의됐지만 현재 엔진에는 아직 통합되지 않았습니다.',
        },
        {
          sourceType: 'CAPTURED_MESH',
          enabled: false,
          coverage: 'NONE',
          reason:
            '현 단계에서는 별도 캡처 메쉬 공급원이 연결되어 있지 않습니다.',
        },
      ],
    };
  }

  private resolveCurrentMode(
    landmarkCount: number,
    mapillaryUsed: boolean,
    coloredRatio: number,
    materialRatio: number,
  ): SceneFidelityPlan['currentMode'] {
    if (landmarkCount >= 3) {
      return 'LANDMARK_ENRICHED';
    }
    if (mapillaryUsed || coloredRatio >= 0.08 || materialRatio >= 0.08) {
      return 'MATERIAL_ENRICHED';
    }

    return 'PROCEDURAL_ONLY';
  }

  private resolveTargetMode(
    currentMode: SceneFidelityPlan['currentMode'],
    mapillaryEvidence: number,
    landmarkCount: number,
    place: ExternalPlaceDetail,
  ): SceneFidelityPlan['targetMode'] {
    const primaryType = place.primaryType ?? '';
    if (
      mapillaryEvidence >= 80 &&
      landmarkCount >= 3 &&
      (primaryType.includes('tourist') ||
        primaryType.includes('point_of_interest'))
    ) {
      return 'REALITY_OVERLAY_READY';
    }
    if (landmarkCount >= 3) {
      return 'LANDMARK_ENRICHED';
    }

    return currentMode;
  }

  private resolveCoreRadius(scale: SceneScale): number {
    if (scale === 'LARGE') {
      return 420;
    }
    if (scale === 'MEDIUM') {
      return 320;
    }

    return 220;
  }

  private resolvePriorities(
    targetMode: SceneFidelityPlan['targetMode'],
    coverageGapRatio: number,
  ): string[] {
    const base = [
      '구조 보존',
      '중심 교차로 완결성',
      '횡단보도/차선 가독성',
      '회색 fallback 축소',
    ];

    const priorities =
      targetMode === 'REALITY_OVERLAY_READY'
        ? [...base, '랜드마크 reality overlay', '핵심 블록 facade/signage 보강']
        : targetMode === 'LANDMARK_ENRICHED'
          ? [...base, '랜드마크 메타데이터 보강']
          : [...base];

    if (coverageGapRatio > 0) {
      priorities.push('전 장소 70% 커버리지 갭 축소');
    }

    return priorities;
  }

  private resolveAchievedCoverageRatio(
    detail: SceneDetail,
    mapillaryEvidence: number,
    facadeEvidenceScore: number,
    landmarkCount: number,
  ): number {
    const crossingScore = Math.min(1, detail.crossings.length / 120);
    const roadMarkingScore = Math.min(1, detail.roadMarkings.length / 700);
    const furnitureScore = Math.min(1, detail.streetFurniture.length / 140);
    const vegetationScore = Math.min(1, detail.vegetation.length / 80);
    const signageScore = Math.min(1, detail.signageClusters.length / 18);
    const facadeScore = Math.min(1, facadeEvidenceScore / 100);
    const mapillaryScore = Math.min(1, mapillaryEvidence / 100);
    const annotationScore = Math.min(1, detail.annotationsApplied.length / 14);
    const landmarkScore = Math.min(1, landmarkCount / 3);

    const weighted =
      crossingScore * 0.08 +
      roadMarkingScore * 0.06 +
      furnitureScore * 0.04 +
      vegetationScore * 0.02 +
      signageScore * 0.1 +
      facadeScore * 0.25 +
      mapillaryScore * 0.3 +
      annotationScore * 0.1 +
      landmarkScore * 0.05;

    return Number(Math.max(0, Math.min(1, weighted)).toFixed(3));
  }

  private resolveFacadeEvidenceScore(
    coloredRatio: number,
    materialRatio: number,
    detail: SceneDetail,
  ): number {
    const explicitSignal = ((coloredRatio + materialRatio) / 2) * 100;
    const mapillarySignal = Math.min(
      22,
      detail.provenance.mapillaryFeatureCount * 0.12,
    );
    const signageSignal = Math.min(18, detail.signageClusters.length * 1.2);
    const annotationSignal = Math.min(
      12,
      detail.annotationsApplied.length * 0.75,
    );
    const weakEvidencePenalty =
      detail.facadeHints.length > 0
        ? (detail.facadeHints.filter((hint) => hint.weakEvidence).length /
            detail.facadeHints.length) *
          8
        : 0;

    return Math.max(
      0,
      explicitSignal +
        mapillarySignal +
        signageSignal +
        annotationSignal -
        weakEvidencePenalty,
    );
  }

  private resolveEvidenceLevel(
    score: number,
  ): SceneFidelityPlan['evidence']['structure'] {
    if (score >= 80) {
      return 'HIGH';
    }
    if (score >= 30) {
      return 'MEDIUM';
    }
    if (score > 0) {
      return 'LOW';
    }

    return 'NONE';
  }
}
