import { Injectable } from '@nestjs/common';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { PlacePackage } from '../../../places/types/place.types';
import type {
  SceneDetail,
  SceneFidelityPlan,
  SceneScale,
} from '../../types/scene.types';
import {
  CuratedAssetResolverService,
  type CuratedAssetPayload,
} from './curated-asset-resolver.service';

@Injectable()
export class SceneFidelityPlannerService {
  constructor(
    private readonly curatedAssetResolver: CuratedAssetResolverService,
  ) {}

  buildPlan(
    place: ExternalPlaceDetail,
    scale: SceneScale,
    placePackage: PlacePackage,
    detail: SceneDetail,
    curatedPayload?: CuratedAssetPayload,
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
    const overlayReadiness = this.resolveOverlayReadiness(
      detail,
      mapillaryEvidence,
      landmarkCount,
      facadeEvidenceScore,
      curatedPayload,
    );
    const rawCoverageRatio = this.resolveAchievedCoverageRatio(
      detail,
      mapillaryEvidence,
      facadeEvidenceScore,
      landmarkCount,
      overlayReadiness,
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
      overlayReadiness,
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
          ? this.resolveProductionPhase(detail, facadeEvidenceScore)
          : 'PHASE_1_BASELINE',
      coreRadiusM: this.resolveCoreRadius(scale),
      priorities: this.resolvePriorities(
        targetMode,
        coverageGapRatio,
        overlayReadiness,
      ),
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
          coverage: detail.provenance.mapillaryUsed
            ? overlayReadiness.mapillaryReady
              ? 'FULL'
              : 'CORE'
            : 'NONE',
          reason: detail.provenance.mapillaryUsed
            ? overlayReadiness.mapillaryReady
              ? '거리 객체/파사드/사인 밀도가 충분해 overlay-ready 기준을 충족합니다.'
              : '거리 객체와 일부 파사드/사인 힌트를 제공합니다.'
            : '현재 이 scene에서는 사용 가능한 Mapillary 증거가 부족합니다.',
        },
        {
          sourceType: 'CURATED_ASSET_PACK',
          enabled: overlayReadiness.curatedReady,
          coverage: overlayReadiness.curatedReady ? 'CORE' : 'NONE',
          reason: overlayReadiness.curatedReason,
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
    overlayReadiness: {
      mapillaryReady: boolean;
      curatedReady: boolean;
      curatedReason: string;
      atmosphereReady: boolean;
    },
  ): SceneFidelityPlan['targetMode'] {
    const primaryType = place.primaryType ?? '';
    if (
      mapillaryEvidence >= 80 &&
      landmarkCount >= 3 &&
      overlayReadiness.mapillaryReady &&
      overlayReadiness.curatedReady &&
      (primaryType.includes('tourist') ||
        primaryType.includes('point_of_interest') ||
        primaryType.includes('transit') ||
        primaryType.includes('shopping') ||
        primaryType.includes('commercial'))
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
    overlayReadiness: {
      mapillaryReady: boolean;
      curatedReady: boolean;
      curatedReason: string;
      atmosphereReady: boolean;
    },
  ): string[] {
    const base = [
      '구조 보존',
      '중심 교차로 완결성',
      '횡단보도/차선 가독성',
      '회색 fallback 축소',
    ];

    const priorities =
      targetMode === 'REALITY_OVERLAY_READY'
        ? [
            ...base,
            '랜드마크 reality overlay',
            '핵심 블록 facade/signage 보강',
            'atmosphere-overlay 일관성 확보',
          ]
        : targetMode === 'LANDMARK_ENRICHED'
          ? [...base, '랜드마크 메타데이터 보강']
          : [...base];

    if (coverageGapRatio > 0) {
      priorities.push('전 장소 70% 커버리지 갭 축소');
    }
    if (!overlayReadiness.atmosphereReady) {
      priorities.push('atmosphere-overlay 정합성 보강');
    }

    return priorities;
  }

  private resolveAchievedCoverageRatio(
    detail: SceneDetail,
    mapillaryEvidence: number,
    facadeEvidenceScore: number,
    landmarkCount: number,
    overlayReadiness: {
      mapillaryReady: boolean;
      curatedReady: boolean;
      curatedReason: string;
      atmosphereReady: boolean;
    },
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
    const overlayReadinessScore =
      (overlayReadiness.mapillaryReady ? 0.45 : 0) +
      (overlayReadiness.curatedReady ? 0.3 : 0) +
      (overlayReadiness.atmosphereReady ? 0.25 : 0);

    const weighted =
      crossingScore * 0.08 +
      roadMarkingScore * 0.06 +
      furnitureScore * 0.04 +
      vegetationScore * 0.02 +
      signageScore * 0.1 +
      facadeScore * 0.25 +
      mapillaryScore * 0.3 +
      annotationScore * 0.1 +
      landmarkScore * 0.03 +
      overlayReadinessScore * 0.02;

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

  private resolveOverlayReadiness(
    detail: SceneDetail,
    mapillaryEvidence: number,
    _landmarkCount: number,
    _facadeEvidenceScore: number,
    curatedPayload?: CuratedAssetPayload,
  ): {
    mapillaryReady: boolean;
    curatedReady: boolean;
    curatedReason: string;
    atmosphereReady: boolean;
  } {
    const mapillaryReady =
      detail.provenance.mapillaryUsed &&
      mapillaryEvidence >= 85 &&
      detail.signageClusters.length >= 1 &&
      detail.facadeHints.length >= 1;

    const curatedReadiness = this.curatedAssetResolver!.resolveReadiness(
      detail,
      curatedPayload,
    );
    const curatedReady = curatedReadiness.ready;
    const curatedReason = curatedReadiness.reason;

    const staticPreset = detail.staticAtmosphere?.preset;
    const sceneTone = detail.sceneWideAtmosphereProfile?.cityTone;
    const weather = detail.sceneWideAtmosphereProfile?.weatherOverlay;
    const atmosphereReady =
      staticPreset === 'NIGHT_NEON' ||
      (sceneTone === 'dense_commercial' &&
        (weather === 'night' || weather === 'wet_road'));

    return {
      mapillaryReady,
      curatedReady,
      curatedReason,
      atmosphereReady,
    };
  }

  private resolveProductionPhase(
    detail: SceneDetail,
    facadeEvidenceScore: number,
  ): SceneFidelityPlan['phase'] {
    const strongMapillary =
      detail.provenance.mapillaryUsed &&
      detail.provenance.mapillaryFeatureCount >= 120 &&
      detail.provenance.mapillaryImageCount >= 3;
    const strongFacade =
      detail.facadeHints.length >= 1 &&
      detail.signageClusters.length >= 1 &&
      facadeEvidenceScore >= 85;
    const strongAnnotations = detail.annotationsApplied.length >= 3;

    if (strongMapillary && strongFacade && strongAnnotations) {
      return 'PHASE_3_PRODUCTION_LOCK';
    }

    return 'PHASE_2_HYBRID_FOUNDATION';
  }
}
