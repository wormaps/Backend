import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import {
  LandmarkAnnotationManifest,
  SceneDetail,
  SceneMeta,
} from '../../types/scene.types';
import { appendSceneDiagnosticsLog } from '../../storage/scene-storage.utils';
import { SceneLandmarkApplierService } from './scene-landmark-applier.service';
import { SceneFacadeHintMergerService } from './scene-facade-hint-merger.service';
import { SceneCrossingDecalBuilderService } from './scene-crossing-decal-builder.service';
import { SceneSignageMergerService } from './scene-signage-merger.service';
import { SceneFurnitureMergerService } from './scene-furniture-merger.service';
import { SceneHeroPromotionService } from './scene-hero-promotion.service';
import {
  buildPlaceReadabilityDiagnostics,
  clampCoverage,
  summarizeMaterialClasses,
} from './hero-override.utils';
import { mergeByObjectId } from './merge-by-object-id.utils';

@Injectable()
export class SceneHeroOverrideApplierService {
  constructor(
    private readonly landmarkApplier: SceneLandmarkApplierService,
    private readonly facadeHintMerger: SceneFacadeHintMergerService,
    private readonly crossingDecalBuilder: SceneCrossingDecalBuilderService,
    private readonly signageMerger: SceneSignageMergerService,
    private readonly furnitureMerger: SceneFurnitureMergerService,
    private readonly heroPromotion: SceneHeroPromotionService,
    private readonly appLoggerService: AppLoggerService,
  ) {}

  async apply(
    meta: SceneMeta,
    detail: SceneDetail,
    manifest: LandmarkAnnotationManifest,
  ): Promise<{ meta: SceneMeta; detail: SceneDetail }> {
    const landmarkAssignments = this.landmarkApplier.resolveLandmarkAssignments(
      meta,
      manifest,
    );
    const annotatedBuildings = this.landmarkApplier.applyLandmarkAnnotations(
      meta.buildings,
      landmarkAssignments,
    );
    const facadeHints = this.facadeHintMerger.mergeFacadeHints(
      annotatedBuildings,
      detail,
      landmarkAssignments,
    );
    const crossings = this.crossingDecalBuilder.buildCrossings(detail, manifest);
    const signageClusters = this.signageMerger.mergeSignageClusters(
      detail,
      manifest,
    );
    const streetFurniture = this.furnitureMerger.mergeStreetFurniture(
      detail,
      manifest,
    );
    const roadDecals = mergeByObjectId(
      detail.roadDecals ?? [],
      this.crossingDecalBuilder.buildCrossingDecals(manifest),
    );
    const intersectionProfiles =
      this.crossingDecalBuilder.buildIntersectionProfiles(detail, manifest);
    const landmarkAnchors = mergeByObjectId(
      meta.landmarkAnchors,
      manifest.landmarks.map((landmark) => ({
        objectId: landmark.objectId ?? landmark.id,
        name: landmark.name,
        location: landmark.anchor,
        kind: landmark.kind,
      })),
    );
    const annotationsApplied = [
      ...detail.annotationsApplied,
      manifest.id,
      ...manifest.landmarks.map((item) => item.id),
      ...manifest.crossings.map((item) => item.id),
      ...manifest.signageClusters.map((item) => item.id),
    ];

    const structuralCoverage = {
      ...meta.structuralCoverage,
      heroLandmarkCoverage: 1,
    };
    const mergedDetail: SceneDetail = {
      ...detail,
      detailStatus:
        detail.detailStatus === 'OSM_ONLY' ? 'PARTIAL' : detail.detailStatus,
      crossings,
      streetFurniture,
      facadeHints,
      signageClusters,
      intersectionProfiles,
      roadDecals,
      placeReadabilityDiagnostics: buildPlaceReadabilityDiagnostics(
        annotatedBuildings,
        facadeHints,
        roadDecals,
        streetFurniture,
        manifest.streetFurnitureRows.length,
      ),
      annotationsApplied,
      structuralCoverage,
      provenance: {
        ...detail.provenance,
        overrideCount: annotationsApplied.length,
      },
    };

    const mergedMeta: SceneMeta = {
      ...meta,
      buildings: annotatedBuildings,
      detailStatus: mergedDetail.detailStatus,
      landmarkAnchors,
      structuralCoverage,
      materialClasses: summarizeMaterialClasses(facadeHints),
      visualCoverage: {
        structure: meta.visualCoverage.structure,
        streetDetail: clampCoverage(meta.visualCoverage.streetDetail + 0.2),
        landmark: clampCoverage(meta.visualCoverage.landmark + 0.25),
        signage: clampCoverage(meta.visualCoverage.signage + 0.2),
      },
    };

    this.heroPromotion.promoteContextualHeroBuildings(
      mergedMeta,
      mergedDetail,
      manifest.id,
    );

    const payload = {
      manifestId: manifest.id,
      assignedLandmarks: [...landmarkAssignments.keys()],
      addedCrossings: manifest.crossings.length,
      addedSignageClusters: manifest.signageClusters.length,
      addedStreetFurnitureRows: manifest.streetFurnitureRows.length,
      annotationsApplied: annotationsApplied.length,
      structuralCoverage,
    };
    this.appLoggerService.info('scene.annotation_manifest.applied', {
      sceneId: meta.sceneId,
      step: 'annotation_manifest',
      ...payload,
    });
    try {
      await appendSceneDiagnosticsLog(
        meta.sceneId,
        'annotation_manifest',
        payload,
      );
    } catch (error) {
      this.appLoggerService.warn('scene.diagnostics.log-failed', {
        sceneId: meta.sceneId,
        step: 'annotation_manifest',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      meta: mergedMeta,
      detail: mergedDetail,
    };
  }
}
