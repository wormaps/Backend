import { Injectable } from '@nestjs/common';
import {
  LandmarkAnnotationManifest,
  SceneDetail,
  SceneFacadeHint,
  SceneMeta,
} from '../../types/scene.types';
import { mergeByObjectId } from './merge-by-object-id.utils';

@Injectable()
export class SceneFacadeHintMergerService {
  mergeFacadeHints(
    buildings: SceneMeta['buildings'],
    detail: SceneDetail,
    landmarkAssignments: Map<
      string,
      LandmarkAnnotationManifest['landmarks'][number]
    >,
  ): SceneFacadeHint[] {
    const annotationHints = [...landmarkAssignments.entries()].map(
      ([objectId, annotation]) => {
        const matchedBuilding =
          buildings.find((building) => building.objectId === objectId) ?? null;
        const buildingHeight = matchedBuilding?.heightMeters ?? 12;
        const facadeHint = annotation.facadeHint;
        const contextProfile: SceneFacadeHint['contextProfile'] =
          annotation.importance === 'primary'
            ? 'NEON_CORE'
            : 'COMMERCIAL_STRIP';
        const districtCluster: SceneFacadeHint['districtCluster'] =
          annotation.kind === 'PLAZA'
            ? 'landmark_plaza'
            : annotation.importance === 'primary'
              ? 'landmark_plaza'
              : 'secondary_retail';
        const evidenceStrength: SceneFacadeHint['evidenceStrength'] = 'strong';
        const inheritedFacadeEdgeIndex = detail.facadeHints.find(
          (item) => item.objectId === objectId,
        )?.facadeEdgeIndex;

        return {
          objectId,
          anchor: annotation.anchor,
          facadeEdgeIndex:
            facadeHint?.facadeEdgeIndex ?? inheritedFacadeEdgeIndex ?? null,
          windowBands: Math.max(2, Math.floor(buildingHeight / 3.4)),
          billboardEligible:
            annotation.kind === 'BUILDING' &&
            annotation.importance === 'primary',
          palette:
            facadeHint?.palette ??
            (matchedBuilding?.facadeColor
              ? [matchedBuilding.facadeColor]
              : ['#b8c0c8']),
          shellPalette: facadeHint?.shellPalette,
          panelPalette: facadeHint?.panelPalette,
          materialClass: facadeHint?.materialClass ?? 'mixed',
          signageDensity: facadeHint?.signageDensity ?? 'medium',
          emissiveStrength: facadeHint?.emissiveStrength ?? 0.55,
          glazingRatio: facadeHint?.glazingRatio ?? 0.3,
          visualArchetype: matchedBuilding?.visualArchetype,
          geometryStrategy: matchedBuilding?.geometryStrategy,
          facadePreset: matchedBuilding?.facadePreset,
          podiumLevels: matchedBuilding?.podiumLevels,
          setbackLevels: matchedBuilding?.setbackLevels,
          cornerChamfer: matchedBuilding?.cornerChamfer,
          roofAccentType: matchedBuilding?.roofAccentType,
          windowPatternDensity: matchedBuilding?.windowPatternDensity,
          signBandLevels: matchedBuilding?.signBandLevels,
          visualRole:
            facadeHint?.visualRole ??
            (annotation.importance === 'primary'
              ? 'hero_landmark'
              : 'edge_landmark'),
          facadeSpec: matchedBuilding?.facadeSpec,
          podiumSpec: matchedBuilding?.podiumSpec,
          signageSpec: matchedBuilding?.signageSpec,
          roofSpec: matchedBuilding?.roofSpec,
          contextProfile,
          districtCluster,
          districtConfidence: annotation.importance === 'primary' ? 0.95 : 0.78,
          evidenceStrength,
          contextualMaterialUpgrade: true,
          weakEvidence: false,
        };
      },
    );

    return mergeByObjectId(detail.facadeHints, annotationHints);
  }
}
