# GLB Artifact And Manifest Metadata

## Problem
GLB artifact와 manifest가 실제 최종 품질 상태를 충분히 설명하지 못하고 있었다.

## Change
- `SceneBuildManifest`에 `finalTier`, `finalTierReasonCodes`, `qaSummary` 추가
- completed build는 `glbArtifact`를 통해 mesh summary와 QA summary를 함께 가진다
- manifest는 completed build에서 GLB artifact hash를 기록한다

## Why
문서 기준에서 final tier는 QA 이후 확정되며, artifact와 manifest 둘 다 그 결과를 보존해야 replay와 운영 판단이 가능하다.

## Current Limit
- 아직 glTF extras를 실제 바이너리에 기록하지는 않는다
- artifact hash는 현재 GLB artifact 메타데이터의 canonical fingerprint다
- 실제 binary hash는 이후 glTF export 단계에서 보강한다
