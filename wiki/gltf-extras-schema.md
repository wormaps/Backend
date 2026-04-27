# glTF Extras Schema

## Purpose

WorMap metadata may be embedded in glTF `extras` for debugging and replay.
The payload must remain small, stable, and contract-driven.

## Target Shape

```ts
type WorMapGltfExtras = {
  worMap: {
    schemaVersion: string;
    sceneId: string;
    buildId: string;
    snapshotBundleId: string;
    finalTier: string;
    finalTierReasonCodes: string[];
    qaSummary: {
      issueCount: number;
      criticalCount: number;
      majorCount: number;
      minorCount: number;
      infoCount: number;
      warnActionCount: number;
      recordActionCount: number;
      failBuildCount: number;
      downgradeTierCount: number;
      stripDetailCount: number;
      topCodes: string[];
    };
    schemaVersions: Record<string, string>;
    meshSummary: {
      nodeCount: number;
      materialCount: number;
      primitiveCounts: Record<string, number>;
    };
    artifactHash: string;
    validationStamp: string;
    sidecarRef?: string;
  };
};

type WorMapGltfSidecar = {
  worMap: {
    schemaVersion: string;
    sidecarRef: string;
    sceneId: string;
    buildId: string;
    snapshotBundleId: string;
    finalTier: string;
    finalTierReasonCodes: string[];
    qaSummary: {
      issueCount: number;
      criticalCount: number;
      majorCount: number;
      minorCount: number;
      infoCount: number;
      warnActionCount: number;
      recordActionCount: number;
      failBuildCount: number;
      downgradeTierCount: number;
      stripDetailCount: number;
      topCodes: string[];
    };
    schemaVersions: Record<string, string>;
    meshSummary: {
      nodeCount: number;
      materialCount: number;
      primitiveCounts: Record<string, number>;
    };
    attribution: {
      required: boolean;
      entries: Array<{ provider: string; label: string; url?: string }>;
    };
    extrasValidationStamp: string;
    validationStamp: string;
  };
};
```

## Placement

- root `asset.extras.worMap` for build-level metadata
- optional node/material extras only when needed for debugging

## Sidecar Escape Hatch

Use a sidecar manifest when:

- payload size becomes too large
- per-node metadata would bloat the GLB
- compliance or replay data should remain separate from the binary

Sidecar metadata must preserve the same build identity and validation stamp.

## Stability Rules

- canonical JSON serialization only
- no provider raw schema in extras
- no mutable runtime-only fields
- no hidden repair data

## Current Project State

The repository defines the extras/sidecar contract shape.
Phase 19 still requires real GLB byte emission and byte-level validation before it can be considered complete.
