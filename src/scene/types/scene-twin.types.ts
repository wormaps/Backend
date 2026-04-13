import { ExternalPlaceDetail } from '../../places/types/external-place.types';
import {
  Coordinate,
  GeoBounds,
  PlacePackage,
} from '../../places/types/place.types';
import {
  SceneDetail,
  SceneLandmarkAnchor,
  SceneMeta,
} from './scene-model.types';
import { SceneQualityGateResult, SceneScale } from './scene-domain.types';

export type TwinSnapshotProvider =
  | 'GOOGLE_PLACES'
  | 'OVERPASS'
  | 'MAPILLARY'
  | 'SCENE_PIPELINE'
  | 'QUALITY_GATE';

export type TwinSnapshotKind =
  | 'PLACE_SEARCH_QUERY'
  | 'PLACE_DETAIL'
  | 'PLACE_PACKAGE'
  | 'PROVIDER_TRACE'
  | 'SCENE_META'
  | 'SCENE_DETAIL'
  | 'QUALITY_GATE';

export interface SearchQuerySnapshotPayload {
  query: string;
  scale: SceneScale;
  searchLimit: number;
  resolvedRadiusM: number;
}

export interface SnapshotReplayRequest {
  method: 'GET' | 'POST' | 'DERIVED';
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
  body?: Record<string, unknown> | string | null;
  notes?: string;
}

export interface SnapshotResponseSummary {
  itemCount?: number;
  objectId?: string;
  status?: 'SUCCESS' | 'DERIVED';
  fields?: string[];
  diagnostics?: Record<string, number | string | boolean | null>;
}

export interface UpstreamFetchEnvelope {
  provider: string;
  requestedAt: string;
  receivedAt: string;
  url: string;
  method: string;
  request: {
    headers?: Record<string, string>;
    body?: unknown;
  };
  response: {
    status: number;
    body: unknown;
  };
}

export interface ProviderTrace {
  provider: TwinSnapshotProvider;
  requests: SnapshotReplayRequest[];
  responseSummary: SnapshotResponseSummary;
  observedAt: string;
  upstreamEnvelopes?: UpstreamFetchEnvelope[];
}

export interface SourceSnapshotRecord {
  snapshotId: string;
  provider: TwinSnapshotProvider;
  kind: TwinSnapshotKind;
  schemaVersion: string;
  capturedAt: string;
  contentHash: string;
  replayable: boolean;
  storage: 'INLINE_JSON';
  request: SnapshotReplayRequest;
  responseSummary: SnapshotResponseSummary;
  upstreamEnvelopes?: UpstreamFetchEnvelope[];
  payload:
    | SearchQuerySnapshotPayload
    | ExternalPlaceDetail
    | PlacePackage
    | SceneMeta
    | SceneDetail
    | SceneQualityGateResult;
}

export interface SourceSnapshotManifest {
  manifestId: string;
  sceneId: string;
  generatedAt: string;
  snapshots: SourceSnapshotRecord[];
}

export interface SpatialFrameManifest {
  frameId: string;
  sceneId: string;
  generatedAt: string;
  geodeticCrs: 'WGS84';
  localFrame: 'ENU';
  axis: 'Z_UP';
  unit: 'meter';
  heightReference: 'ELLIPSOID_APPROX';
  anchor: Coordinate;
  bounds: GeoBounds;
  extentMeters: {
    width: number;
    depth: number;
    radius: number;
  };
  transform: {
    metersPerLat: number;
    metersPerLng: number;
    localAxes: {
      east: [1, 0, 0];
      north: [0, 0, -1];
      up: [0, 1, 0];
    };
  };
  terrain: {
    mode: 'FLAT_PLACEHOLDER';
    hasElevationModel: false;
    baseHeightMeters: 0;
    notes: string;
  };
  verification: {
    sampleCount: number;
    maxRoundTripErrorM: number;
    avgRoundTripErrorM: number;
    samples: Array<{
      label: string;
      local: {
        eastM: number;
        northM: number;
      };
      roundTripErrorM: number;
    }>;
  };
  delivery: {
    glbAxisConvention: 'Y_UP_DERIVED';
    transformRequired: true;
  };
}

export type TwinEntityKind =
  | 'SCENE'
  | 'PLACE'
  | 'BUILDING'
  | 'ROAD'
  | 'WALKWAY'
  | 'POI'
  | 'CROSSING'
  | 'STREET_FURNITURE'
  | 'VEGETATION'
  | 'LAND_COVER'
  | 'LINEAR_FEATURE'
  | 'LANDMARK';

export type TwinComponentKind =
  | 'IDENTITY'
  | 'SPATIAL'
  | 'STRUCTURE'
  | 'APPEARANCE'
  | 'DELIVERY_BINDING'
  | 'STATE_BINDING'
  | 'SOURCE_REFERENCE';

export type TwinPropertyOrigin = 'observed' | 'inferred' | 'defaulted';

export interface TwinProperty {
  propertyId: string;
  name: string;
  value: unknown;
  valueType:
    | 'string'
    | 'number'
    | 'boolean'
    | 'coordinate'
    | 'coordinate_array'
    | 'json';
  origin: TwinPropertyOrigin;
  confidence: number;
  sourceSnapshotIds: string[];
  evidenceIds: string[];
}

export interface TwinComponent {
  componentId: string;
  entityId: string;
  kind: TwinComponentKind;
  label: string;
  properties: TwinProperty[];
}

export interface TwinRelationship {
  relationshipId: string;
  sourceEntityId: string;
  targetEntityId: string;
  type:
    | 'SCENE_CONTAINS'
    | 'LOCATED_AT'
    | 'DERIVED_FROM'
    | 'ANNOTATES'
    | 'NEAR_LANDMARK';
}

export interface TwinEntity {
  entityId: string;
  objectId: string;
  kind: TwinEntityKind;
  label: string;
  sourceObjectId: string;
  componentIds: string[];
  tags: string[];
}

export type TwinEvidenceKind =
  | 'GEOMETRY'
  | 'APPEARANCE'
  | 'STATE'
  | 'SEMANTIC';

export interface TwinEvidence {
  evidenceId: string;
  entityId: string;
  kind: TwinEvidenceKind;
  sourceSnapshotId: string;
  observedAt: string;
  confidence: number;
  provenance: 'observed' | 'inferred' | 'defaulted';
  summary: string;
  payload: Record<string, unknown>;
}

export interface DeliveryArtifactManifest {
  buildId: string;
  sceneId: string;
  generatedAt: string;
  scale: SceneScale;
  artifacts: Array<{
    artifactId: string;
    type: 'GLB' | 'SCENE_META' | 'SCENE_DETAIL';
    apiPath: string;
    localPath: string | null;
    derivedFromSnapshotIds: string[];
    semanticMetadataCoverage: 'NONE' | 'PARTIAL';
  }>;
}

export interface TwinStateChannel {
  channelId: string;
  mode: 'SYNTHETIC_RULES';
  bindingScope: 'SCENE';
  entityId: string;
  bindings: Array<{
    entityId: string;
    componentKind: TwinComponentKind;
    propertyNames: string[];
  }>;
  supportedQueries: Array<'timeOfDay' | 'weather' | 'date'>;
  notes: string;
}

export type ValidationGateState = 'PASS' | 'WARN' | 'FAIL';

export interface ValidationGateResult {
  gate: 'geometry' | 'semantic' | 'spatial' | 'delivery' | 'state';
  state: ValidationGateState;
  reasonCodes: string[];
  metrics: Record<string, boolean | number | string>;
}

export interface ValidationReport {
  reportId: string;
  sceneId: string;
  generatedAt: string;
  summary: ValidationGateState;
  gates: ValidationGateResult[];
  qualityGate?: SceneQualityGateResult;
}

export interface MidQaCheck {
  id:
    | 'provider_trace'
    | 'snapshot_replayability'
    | 'observed_coverage'
    | 'spatial_roundtrip'
    | 'delivery_binding'
    | 'state_binding'
    | 'mesh_health';
  state: ValidationGateState;
  summary: string;
  metrics: Record<string, number | string | boolean | null>;
}

export interface MidQaReport {
  reportId: string;
  sceneId: string;
  generatedAt: string;
  summary: ValidationGateState;
  score: {
    overall: number;
    confidence: 'low' | 'medium' | 'high';
  };
  checks: MidQaCheck[];
  findings: Array<{
    severity: 'info' | 'warn' | 'error';
    message: string;
  }>;
  references: {
    twinBuildId: string;
    validationReportId: string;
    diagnosticsLogPath?: string;
  };
}

export interface SceneTwinGraph {
  twinId: string;
  sceneId: string;
  buildId: string;
  generatedAt: string;
  sourceSnapshots: SourceSnapshotManifest;
  spatialFrame: SpatialFrameManifest;
  entities: TwinEntity[];
  relationships: TwinRelationship[];
  components: TwinComponent[];
  evidence: TwinEvidence[];
  delivery: DeliveryArtifactManifest;
  stateChannels: TwinStateChannel[];
  landmarkAnchors: SceneLandmarkAnchor[];
  stats: {
    entityCount: number;
    componentCount: number;
    relationshipCount: number;
    evidenceCount: number;
  };
}
