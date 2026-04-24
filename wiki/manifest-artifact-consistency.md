# Manifest / Artifact Consistency

## Purpose

`SceneBuildManifest` must describe the exact artifact that was validated and published.
If the manifest and artifact disagree, the build is not valid.

## Required Match Fields

- `sceneId`
- `buildId`
- `state`
- `finalTier`
- `finalTierReasonCodes`
- `qaSummary`
- `schemaVersions`
- `artifactHashes.glb`
- `meshSummary` / node-material counts, if present

## Canonical Rule

The manifest must be derived from the same validated artifact instance.
No post-hoc recomputation may change the published values.

## Verification Rules

| Field | Rule |
|---|---|
| scene/build identity | must match exactly |
| final tier | must match QA outcome |
| QA summary | must match artifact validation summary |
| GLB hash | must be computed from the actual artifact bytes |
| schema versions | must match the published contract version set |
| attribution/compliance | must be preserved in the manifest |

## Mismatch Policy

Any mismatch is critical.

1. reject publication
2. keep the artifact in quarantine or failure storage
3. emit a replayable diagnostic report
4. require rebuild from the same input bundle

## Current Project State

The current implementation still uses placeholder artifact metadata.
That is acceptable only as an interim stub; it is not the target contract.

## Non-Goals

- No silent auto-fix
- No manifest-only success
- No accepting placeholder hashes as final truth
