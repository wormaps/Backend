import type {
  SceneDetail,
  SceneQualityGateResult,
  SpatialFrameManifest,
  ValidationGateResult,
  ValidationReport,
} from '../../types/scene.types';
import { hashValue, roundMetric, resolveGateSummary } from './twin-hash.utils';

export interface TwinPropertyOriginCounts {
  observed: number;
  inferred: number;
  defaulted: number;
}

export function countTwinPropertyOrigins(
  components: import('../../types/scene.types').TwinComponent[],
): TwinPropertyOriginCounts {
  const counts: TwinPropertyOriginCounts = {
    observed: 0,
    inferred: 0,
    defaulted: 0,
  };

  for (const component of components) {
    for (const property of component.properties) {
      if (property.origin === 'observed') {
        counts.observed += 1;
      } else if (property.origin === 'inferred') {
        counts.inferred += 1;
      } else {
        counts.defaulted += 1;
      }
    }
  }

  return counts;
}

export function buildValidationReport(args: {
  sceneId: string;
  generatedAt: string;
  twinEntityCount: number;
  twinComponentCount: number;
  evidenceCount: number;
  deliveryArtifactCount: number;
  spatialFrame: SpatialFrameManifest;
  assetPath: string;
  qualityGate: SceneQualityGateResult;
  detail: SceneDetail;
  sceneStateBindingCount: number;
  entityStateBindingCount: number;
  twinPropertyOriginCounts: TwinPropertyOriginCounts;
}): ValidationReport {
  const geometryGate = buildGeometryGate(args.qualityGate);
  const semanticGate = buildSemanticGate(
    args.twinEntityCount,
    args.twinComponentCount,
    args.evidenceCount,
    args.detail,
    args.twinPropertyOriginCounts,
  );
  const spatialGate = buildSpatialGate(args.spatialFrame);
  const deliveryGate = buildDeliveryGate(
    args.assetPath,
    args.deliveryArtifactCount,
  );
  const stateGate = buildStateGate({
    detail: args.detail,
    sceneStateBindingCount: args.sceneStateBindingCount,
    entityStateBindingCount: args.entityStateBindingCount,
  });
  const gates = [
    geometryGate,
    semanticGate,
    spatialGate,
    deliveryGate,
    stateGate,
  ];
  const summary = resolveGateSummary(gates);

  return {
    reportId: `validation-${hashValue(args.sceneId).slice(0, 12)}`,
    sceneId: args.sceneId,
    generatedAt: args.generatedAt,
    summary,
    gates,
    qualityGate: args.qualityGate,
  };
}

function buildGeometryGate(
  qualityGate: SceneQualityGateResult,
): ValidationGateResult {
  const meshSummary = qualityGate.meshSummary;
  const state =
    meshSummary.criticalEmptyOrInvalidGeometryCount > 0 ||
    meshSummary.criticalPolygonBudgetExceededCount > 0
      ? 'FAIL'
      : meshSummary.emptyOrInvalidGeometryCount > 0 ||
          meshSummary.totalSkipped > 0
        ? 'WARN'
        : 'PASS';

  return {
    gate: 'geometry',
    state,
    reasonCodes:
      state === 'PASS'
        ? []
        : [
            meshSummary.emptyOrInvalidGeometryCount > 0
              ? 'NON_CRITICAL_INVALID_GEOMETRY'
              : null,
            meshSummary.totalSkipped > 0 ? 'SKIPPED_GEOMETRY' : null,
          ].filter((value): value is string => Boolean(value)),
    metrics: {
      totalSkipped: meshSummary.totalSkipped,
      emptyOrInvalidGeometryCount: meshSummary.emptyOrInvalidGeometryCount,
      missingSourceCount: meshSummary.missingSourceCount,
      qualityGateState: qualityGate.state,
    },
  };
}

function buildSemanticGate(
  twinEntityCount: number,
  twinComponentCount: number,
  evidenceCount: number,
  detail: SceneDetail,
  twinPropertyOriginCounts: TwinPropertyOriginCounts,
): ValidationGateResult {
  const buildingCount = Math.max(detail.facadeHints.length, 1);
  const observedAppearanceCount =
    detail.provenance.osmTagCoverage.coloredBuildings +
    detail.provenance.osmTagCoverage.materialBuildings;
  const observedAppearanceRatio = Math.min(
    1,
    observedAppearanceCount / buildingCount,
  );
  const totalPropertyCount =
    twinPropertyOriginCounts.observed +
    twinPropertyOriginCounts.inferred +
    twinPropertyOriginCounts.defaulted;
  const inferredPropertyRatio =
    totalPropertyCount > 0
      ? (twinPropertyOriginCounts.inferred +
          twinPropertyOriginCounts.defaulted) /
        totalPropertyCount
      : 0;
  const defaultedPropertyRatio =
    totalPropertyCount > 0
      ? twinPropertyOriginCounts.defaulted / totalPropertyCount
      : 0;
  const hasStrongInferenceRisk =
    detail.facadeHints.length > 0
      ? detail.facadeHints.filter((hint) => hint.weakEvidence).length /
          detail.facadeHints.length >=
        0.6
      : false;
  const inferenceGateExceeded =
    inferredPropertyRatio > 0.5 || defaultedPropertyRatio > 0.25;

  const state =
    twinEntityCount === 0 || twinComponentCount === 0
      ? 'FAIL'
      : inferenceGateExceeded
        ? 'WARN'
        : hasStrongInferenceRisk
          ? 'WARN'
          : observedAppearanceRatio < 0.05
            ? 'WARN'
            : 'PASS';
  return {
    gate: 'semantic',
    state,
    reasonCodes:
      state === 'FAIL'
        ? [
            twinEntityCount === 0 || twinComponentCount === 0
              ? 'EMPTY_TWIN_GRAPH'
              : null,
            inferenceGateExceeded
              ? inferredPropertyRatio > 0.5
                ? 'HIGH_INFERRED_PROPERTY_RATIO'
                : null
              : null,
            inferenceGateExceeded
              ? defaultedPropertyRatio > 0.25
                ? 'HIGH_DEFAULTED_PROPERTY_RATIO'
                : null
              : null,
          ].filter((value): value is string => Boolean(value))
        : state === 'WARN'
          ? [
              observedAppearanceRatio < 0.05
                ? 'LOW_OBSERVED_APPEARANCE_COVERAGE'
                : null,
              hasStrongInferenceRisk ? 'HIGH_WEAK_EVIDENCE_RATIO' : null,
              inferenceGateExceeded ? 'HIGH_INFERENCE_PROPERTY_RATIO' : null,
            ].filter((value): value is string => Boolean(value))
          : [],
    metrics: {
      twinEntityCount,
      twinComponentCount,
      evidenceCount,
      observedAppearanceRatio: roundMetric(observedAppearanceRatio),
      weakEvidenceRatio:
        detail.facadeHints.length > 0
          ? roundMetric(
              detail.facadeHints.filter((hint) => hint.weakEvidence).length /
                detail.facadeHints.length,
            )
          : 0,
      facadeHintCount: detail.facadeHints.length,
      propertyOriginObservedCount: twinPropertyOriginCounts.observed,
      propertyOriginInferredCount: twinPropertyOriginCounts.inferred,
      propertyOriginDefaultedCount: twinPropertyOriginCounts.defaulted,
      inferredPropertyRatio: roundMetric(inferredPropertyRatio),
      defaultedPropertyRatio: roundMetric(defaultedPropertyRatio),
      inferenceGateExceeded,
    },
  };
}

function buildDeliveryGate(
  assetPath: string,
  deliveryArtifactCount: number,
): ValidationGateResult {
  const hasAsset = assetPath.trim().length > 0;
  return {
    gate: 'delivery',
    state: hasAsset ? 'PASS' : 'FAIL',
    reasonCodes: hasAsset ? [] : ['MISSING_DELIVERY_ASSET'],
    metrics: {
      assetPath,
      deliveryArtifactCount,
    },
  };
}

function buildSpatialGate(
  spatialFrame: SpatialFrameManifest,
): ValidationGateResult {
  const maxError = spatialFrame.verification.maxRoundTripErrorM;
  const state: ValidationGateResult['state'] =
    maxError > 0.25
      ? 'FAIL'
      : !spatialFrame.terrain.hasElevationModel
        ? 'WARN'
        : 'PASS';
  return {
    gate: 'spatial',
    state,
    reasonCodes:
      state === 'PASS'
        ? []
        : [
            maxError > 0.25 ? 'SPATIAL_ROUNDTRIP_ERROR_EXCEEDED' : null,
            !spatialFrame.terrain.hasElevationModel
              ? 'TERRAIN_MODEL_MISSING'
              : null,
          ].filter((value): value is string => Boolean(value)),
    metrics: {
      sampleCount: spatialFrame.verification.sampleCount,
      maxRoundTripErrorM: maxError,
      avgRoundTripErrorM: spatialFrame.verification.avgRoundTripErrorM,
      terrainMode: spatialFrame.terrain.mode,
      terrainSampleCount: spatialFrame.terrain.sampleCount,
      terrainSource: spatialFrame.terrain.source,
    },
  };
}

function buildStateGate(args: {
  detail: SceneDetail;
  sceneStateBindingCount: number;
  entityStateBindingCount: number;
}): ValidationGateResult {
  const { detail, sceneStateBindingCount, entityStateBindingCount } = args;
  const hasSceneAndEntityBindings =
    sceneStateBindingCount > 0 && entityStateBindingCount > 0;

  return {
    gate: 'state',
    state: hasSceneAndEntityBindings ? 'PASS' : 'WARN',
    reasonCodes: hasSceneAndEntityBindings
      ? []
      : ['SCENE_LEVEL_SYNTHETIC_STATE_ONLY'],
    metrics: {
      detailStatus: detail.detailStatus,
      mapillaryUsed: detail.provenance.mapillaryUsed,
      sceneStateBindingCount,
      entityStateBindingCount,
    },
  };
}
