import { createHash } from 'node:crypto';

import type {
  AttributionSummary,
  QaSummary,
  WorMapGltfExtras,
  WorMapGltfMetadataExport,
  WorMapGltfSidecar,
} from '../../../packages/contracts/manifest';
import type { GlbMeshSummary } from '../../../packages/contracts/manifest';
import type { RealityTier } from '../../../packages/contracts/twin-scene-graph';
import type { SchemaVersionSet } from '../../../packages/core/schemas';

export type GltfMetadataInput = {
  sceneId: string;
  buildId: string;
  snapshotBundleId: string;
  finalTier: RealityTier;
  finalTierReasonCodes: string[];
  qaSummary: QaSummary;
  schemaVersions: SchemaVersionSet;
  meshSummary: GlbMeshSummary;
  artifactHash: string;
  sidecarRef?: string;
  attribution?: AttributionSummary;
};

export class GltfMetadataFactory {
  create(input: GltfMetadataInput): WorMapGltfMetadataExport {
    const extrasCore = {
      schemaVersion: 'worMap.gltf-extras.v1',
      sceneId: input.sceneId,
      buildId: input.buildId,
      snapshotBundleId: input.snapshotBundleId,
      finalTier: input.finalTier,
      finalTierReasonCodes: input.finalTierReasonCodes,
      qaSummary: input.qaSummary,
      schemaVersions: input.schemaVersions,
      meshSummary: input.meshSummary,
      artifactHash: input.artifactHash,
      sidecarRef: input.sidecarRef,
    };

    const extras: WorMapGltfExtras = {
      worMap: {
        ...extrasCore,
        validationStamp: this.hashJson(extrasCore),
      },
    };

    const extrasSerialized = this.serialize(extras);

    if (input.sidecarRef === undefined) {
      return {
        extras: extrasSerialized,
      };
    }

    const sidecarCore = {
      schemaVersion: 'worMap.gltf-sidecar.v1',
      sidecarRef: input.sidecarRef,
      sceneId: input.sceneId,
      buildId: input.buildId,
      snapshotBundleId: input.snapshotBundleId,
      finalTier: input.finalTier,
      finalTierReasonCodes: input.finalTierReasonCodes,
      qaSummary: input.qaSummary,
      schemaVersions: input.schemaVersions,
      meshSummary: input.meshSummary,
      attribution: input.attribution ?? {
        required: false,
        entries: [],
      },
      extrasValidationStamp: extras.worMap.validationStamp,
    };

    const sidecar: WorMapGltfSidecar = {
      worMap: {
        ...sidecarCore,
        validationStamp: this.hashJson(sidecarCore),
      },
    };

    return {
      extras: extrasSerialized,
      sidecar: this.serialize(sidecar),
    };
  }

  private serialize<T>(value: T): { value: T; json: string; jsonHash: string } {
    const json = JSON.stringify(value);
    return {
      value,
      json,
      jsonHash: `sha256:${createHash('sha256').update(json).digest('hex')}`,
    };
  }

  private hashJson(value: unknown): string {
    return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
  }
}
