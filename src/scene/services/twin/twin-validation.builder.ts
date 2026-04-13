import type {
  SceneDetail,
  SceneQualityGateResult,
  SpatialFrameManifest,
  ValidationGateResult,
  ValidationReport,
} from '../../types/scene.types';
import { hashValue, roundMetric, resolveGateSummary } from './twin-hash.utils';

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
}): ValidationReport {
  const geometryGate = buildGeometryGate(args.qualityGate);
  const semanticGate = buildSemanticGate(
    args.twinEntityCount,
    args.twinComponentCount,
    args.evidenceCount,
    args.detail,
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
): ValidationGateResult {
  const buildingCount = Math.max(detail.facadeHints.length, 1);
  const observedAppearanceCount =
    detail.provenance.osmTagCoverage.coloredBuildings +
    detail.provenance.osmTagCoverage.materialBuildings;
  const observedAppearanceRatio = Math.min(
    1,
    observedAppearanceCount / buildingCount,
  );
  const state =
    twinEntityCount === 0 || twinComponentCount === 0
      ? 'FAIL'
      : observedAppearanceRatio < 0.05
        ? 'WARN'
        : 'PASS';
  return {
    gate: 'semantic',
    state,
    reasonCodes:
      state === 'FAIL'
        ? ['EMPTY_TWIN_GRAPH']
        : state === 'WARN'
          ? ['LOW_OBSERVED_APPEARANCE_COVERAGE']
          : [],
    metrics: {
      twinEntityCount,
      twinComponentCount,
      evidenceCount,
      observedAppearanceRatio: roundMetric(observedAppearanceRatio),
      facadeHintCount: detail.facadeHints.length,
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
