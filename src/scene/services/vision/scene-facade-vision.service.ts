import { Injectable } from '@nestjs/common';
import type { MapillaryClient } from '../../../places/clients/mapillary.client';
import type { ExternalPlaceDetail } from '../../../places/types/external-place.types';
import type { PlacePackage } from '../../../places/types/place.types';
import type {
  InferenceReasonCode,
  SceneDetail,
  SceneFacadeHint,
} from '../../types/scene.types';
import { BuildingStyleResolverService } from './building-style-resolver.service';
import {
  applyWeakEvidencePaletteDrift,
  extractDominantFacadeColor,
  resolveExplicitSignalBoost,
  summarizeMapillarySignals,
} from './scene-facade-vision.helpers';
import { resolveDistrictCluster } from './scene-atmosphere-district.utils';
import {
  averageCoordinate,
  buildFacadeContext,
  densityFromEvidence,
  distanceMeters,
  hasExplicitBuildingColor,
  inferBuildingPalette,
  resolveFacadeColorChannels,
  sortCounts,
  uniquePalette,
} from './scene-facade-vision.utils';

@Injectable()
export class SceneFacadeVisionService {
  constructor(
    private readonly buildingStyleResolverService: BuildingStyleResolverService,
  ) {}

  async buildFacadeHints(
    place: ExternalPlaceDetail,
    placePackage: PlacePackage,
    mapillaryImages: Awaited<ReturnType<MapillaryClient['getNearbyImages']>>,
    mapillaryFeatures: Awaited<ReturnType<MapillaryClient['getMapFeatures']>>,
  ): Promise<SceneFacadeHint[]> {
    const buildingAnchors = placePackage.buildings.map((building) => ({
      id: building.id,
      usage: building.usage,
      heightMeters: building.heightMeters,
      anchor: averageCoordinate(building.outerRing) ?? building.outerRing[0]!,
    }));

    return Promise.all(
      placePackage.buildings.map(async (building) => {
        const dominantImageColor = await extractDominantFacadeColor(
          averageCoordinate(building.outerRing) ?? building.outerRing[0]!,
          mapillaryImages,
        );
        const style = this.buildingStyleResolverService.resolveBuildingStyle({
          ...building,
          nearbyImageCount: mapillaryImages.filter(
            (image) =>
              distanceMeters(
                averageCoordinate(building.outerRing) ?? building.outerRing[0]!,
                image.location,
              ) <= 45,
          ).length,
          nearbyFeatureCount: mapillaryFeatures.filter(
            (feature) =>
              distanceMeters(
                averageCoordinate(building.outerRing) ?? building.outerRing[0]!,
                feature.location,
              ) <= 35,
          ).length,
        });
        const anchor =
          averageCoordinate(building.outerRing) ?? building.outerRing[0]!;
        const explicitBuildingColor = hasExplicitBuildingColor(building);
        const nearbyImageCount = mapillaryImages.filter(
          (image) => distanceMeters(anchor, image.location) <= 45,
        ).length;
        const nearbyFeatureCount = mapillaryFeatures.filter(
          (feature) => distanceMeters(anchor, feature.location) <= 35,
        ).length;
        const proximityToCenter = distanceMeters(anchor, place.location);
        const context = buildFacadeContext(
          building,
          anchor,
          proximityToCenter,
          placePackage,
          buildingAnchors,
        );
        const mapillarySignalSummary = summarizeMapillarySignals(
          anchor,
          mapillaryImages,
          mapillaryFeatures,
        );
        const evidenceDensity = densityFromEvidence(
          nearbyImageCount,
          nearbyFeatureCount,
          building.usage,
          proximityToCenter,
        );
        const inferredPalette = inferBuildingPalette(
          building.id,
          building,
          style,
          context,
        );
        const explicitSignalBoost = resolveExplicitSignalBoost(
          building,
          mapillarySignalSummary,
        );
        const hasAnyEvidence = nearbyImageCount > 0 || nearbyFeatureCount > 0;
        const evidenceDensityScore =
          (nearbyImageCount > 0 ? 0.4 : 0) +
          (nearbyFeatureCount > 0 ? 0.3 : 0) +
          (explicitBuildingColor ? 0.2 : 0) +
          (building.facadeMaterial ? 0.1 : 0);
        const weakEvidence =
          evidenceDensityScore < 0.38 &&
          !explicitBuildingColor &&
          !building.facadeMaterial;
        const auxiliaryEvidenceStrength =
          this.buildingStyleResolverService.determineEvidenceStrength({
            ...building,
            nearbyImageCount,
            nearbyFeatureCount,
          });
        const effectiveWeakEvidence =
          weakEvidence && auxiliaryEvidenceStrength === 'WEAK';
        const inferenceReasonCodes: InferenceReasonCode[] = [];
        if (nearbyImageCount === 0) {
          inferenceReasonCodes.push('MISSING_MAPILLARY_IMAGES');
        }
        if (nearbyFeatureCount === 0) {
          inferenceReasonCodes.push('MISSING_MAPILLARY_FEATURES');
        }
        if (!building.facadeColor) {
          inferenceReasonCodes.push('MISSING_FACADE_COLOR');
        }
        if (!building.facadeMaterial) {
          inferenceReasonCodes.push('MISSING_FACADE_MATERIAL');
        }
        if (!building.roofShape) {
          inferenceReasonCodes.push('MISSING_ROOF_SHAPE');
        }
        if (effectiveWeakEvidence) {
          inferenceReasonCodes.push('WEAK_EVIDENCE_RATIO_HIGH');
          inferenceReasonCodes.push('DEFAULT_STYLE_RULE');
          if (
            !building.osmAttributes &&
            !building.googlePlacesInfo &&
            nearbyImageCount === 0 &&
            nearbyFeatureCount === 0
          ) {
            inferenceReasonCodes.push('MISSING_AUXILIARY_DATA');
          }
        }
        const palette = uniquePalette(
          dominantImageColor
            ? [
                dominantImageColor,
                ...(explicitBuildingColor
                  ? style.palette
                  : inferredPalette.palette),
              ]
            : explicitBuildingColor
              ? style.palette
              : inferredPalette.palette,
          4,
        );
        const shellPalette = uniquePalette(
          explicitBuildingColor
            ? style.shellPalette
            : inferredPalette.shellPalette,
          3,
        );
        const panelPalette = uniquePalette(
          explicitBuildingColor
            ? style.panelPalette
            : inferredPalette.panelPalette,
          3,
        );
        const antiUniformPalette = applyWeakEvidencePaletteDrift({
          buildingId: building.id,
          weakEvidence: effectiveWeakEvidence,
          hasExplicitColor: explicitBuildingColor,
          districtProfile: context.districtProfile,
          palette,
          shellPalette,
          panelPalette,
          explicitSignalBoost,
        });
        const shouldApplyContextualUpgrade =
          hasAnyEvidence || explicitBuildingColor || !weakEvidence;
        const channels = resolveFacadeColorChannels({
          palette: antiUniformPalette.palette,
          roofColor: building.roofColor,
          districtProfile: context.districtProfile,
        });
        const districtResolution = resolveDistrictCluster({
          building,
          anchor,
          placeCenter: place.location,
          context,
          buildingAnchors,
          mapillarySignals: {
            ...mapillarySignalSummary,
            nearbyImageCount,
            nearbyFeatureCount,
          },
        });
        return {
          objectId: building.id,
          anchor,
          facadeEdgeIndex:
            this.buildingStyleResolverService.estimateFacadeEdgeIndex(
              building.outerRing,
            ),
          windowBands: style.windowBands,
          billboardEligible: style.billboardEligible,
          palette: antiUniformPalette.palette,
          shellPalette: antiUniformPalette.shellPalette,
          panelPalette: antiUniformPalette.panelPalette,
          mainColor: channels.mainColor,
          accentColor: channels.accentColor,
          trimColor: channels.trimColor,
          roofColor: channels.roofColor,
          materialClass: inferredPalette.materialClass,
          signageDensity: evidenceDensity,
          emissiveStrength:
            building.usage === 'COMMERCIAL'
              ? evidenceDensity === 'high'
                ? 1
                : evidenceDensity === 'medium'
                  ? Math.max(style.emissiveStrength, 0.55)
                  : style.emissiveStrength
              : Math.min(style.emissiveStrength, 0.2),
          glazingRatio: style.glazingRatio,
          visualArchetype: style.visualArchetype,
          geometryStrategy: style.geometryStrategy,
          facadePreset: style.facadePreset,
          podiumLevels: style.podiumLevels,
          setbackLevels: style.setbackLevels,
          cornerChamfer: style.cornerChamfer,
          roofAccentType: style.roofAccentType,
          windowPatternDensity: style.windowPatternDensity,
          signBandLevels: style.signBandLevels,
          weakEvidence: effectiveWeakEvidence,
          inferenceReasonCodes,
          contextProfile: context.districtProfile,
          districtCluster: districtResolution.cluster,
          districtConfidence: districtResolution.confidence,
          evidenceStrength: districtResolution.evidenceStrength,
          contextualMaterialUpgrade:
            shouldApplyContextualUpgrade &&
            (inferredPalette.contextualUpgrade ||
              antiUniformPalette.contextualUpgradeBoost),
        };
      }),
    );
  }
}
