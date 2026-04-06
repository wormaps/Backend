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

    return {
      currentMode,
      targetMode,
      phase:
        targetMode === 'REALITY_OVERLAY_READY'
          ? 'PHASE_2_HYBRID_FOUNDATION'
          : 'PHASE_1_BASELINE',
      coreRadiusM: this.resolveCoreRadius(scale),
      priorities: this.resolvePriorities(targetMode),
      evidence: {
        structure: this.resolveEvidenceLevel(placePackage.buildings.length),
        facade: this.resolveEvidenceLevel(
          Math.round((coloredRatio + materialRatio) * 100),
        ),
        signage: this.resolveEvidenceLevel(Math.round(signageDensity)),
        streetFurniture: this.resolveEvidenceLevel(Math.round(furnitureDensity)),
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
          reason: '아키텍처 후보로 정의됐지만 현재 엔진에는 아직 통합되지 않았습니다.',
        },
        {
          sourceType: 'CAPTURED_MESH',
          enabled: false,
          coverage: 'NONE',
          reason: '현 단계에서는 별도 캡처 메쉬 공급원이 연결되어 있지 않습니다.',
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
  ): string[] {
    const base = [
      '구조 보존',
      '중심 교차로 완결성',
      '횡단보도/차선 가독성',
      '회색 fallback 축소',
    ];

    if (targetMode === 'REALITY_OVERLAY_READY') {
      return [
        ...base,
        '랜드마크 reality overlay',
        '핵심 블록 facade/signage 보강',
      ];
    }
    if (targetMode === 'LANDMARK_ENRICHED') {
      return [...base, '랜드마크 메타데이터 보강'];
    }

    return base;
  }

  private resolveEvidenceLevel(score: number): SceneFidelityPlan['evidence']['structure'] {
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
