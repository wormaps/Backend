# QA Gate Decision Matrix

## 1. Gate Rules

| Severity | Action | Build Result | Tier Impact | Artifact Impact |
|----------|--------|-------------|-------------|----------------|
| critical | fail_build | FAILED | 없음 | GLB 생성 차단 |
| major | downgrade_tier | COMPLETED 가능 | tier 하락 (1단계) | metadata에 reason 기록 |
| major | strip_detail | COMPLETED 가능 | 경우에 따라 하락 | 일부 geometry 제거 |
| minor | warn_only | COMPLETED | 없음 | manifest에 warn_count 기록 |
| info | record_only | COMPLETED | 없음 | manifest에 info_count 기록 |

## 2. QA Issue Code 정책 (49개 등록)

### PROVIDER_* (5)
| Code | Severity | Action |
|------|----------|--------|
| PROVIDER_SNAPSHOT_FAILED | critical | fail_build |
| PROVIDER_RESPONSE_HASH_MISSING | major | warn_only |
| PROVIDER_MAPPER_VERSION_MISSING | minor | warn_only |
| PROVIDER_REPLAYABLE | minor | warn_only |
| PROVIDER_RATE_LIMIT_CAPTURED | info | record_only |

### COMPLIANCE_* (5)
| Code | Severity | Action |
|------|----------|--------|
| COMPLIANCE_PROVIDER_POLICY_RISK | major | warn_only |
| COMPLIANCE_ATTRIBUTION_MISSING | major | warn_only |
| COMPLIANCE_RETENTION_POLICY_RESPECTED | major | warn_only |
| COMPLIANCE_CACHED_PAYLOAD_ALLOWED | major | warn_only |
| COMPLIANCE_MANUAL_SOURCE_EXISTS | info | record_only |

### SPATIAL_* (7)
| Code | Severity | Action |
|------|----------|--------|
| SPATIAL_COORDINATE_OUTLIER | info | record_only |
| SPATIAL_COORDINATE_NAN_INF | critical | fail_build |
| SPATIAL_SCENE_EXTENT | major | warn_only |
| SPATIAL_EXTREME_TERRAIN_SLOPE | minor | warn_only |
| SPATIAL_TERRAIN_GROUNDING_GAP | major | downgrade_tier |
| SPATIAL_COORDINATE_ROUNDTRIP_ERROR | major | downgrade_tier |

### SCENE_* (2)
| Code | Severity | Action |
|------|----------|--------|
| SCENE_DUPLICATED_FOOTPRINT | major | strip_detail |
| SCENE_ROAD_BUILDING_OVERLAP | major | strip_detail |

### GEOMETRY_* (7)
| Code | Severity | Action |
|------|----------|--------|
| GEOMETRY_SELF_INTERSECTION | major | downgrade_tier |
| GEOMETRY_OPEN_SHELL | major | downgrade_tier |
| GEOMETRY_NON_MANIFOLD_EDGE | major | downgrade_tier |
| GEOMETRY_DEGENERATE_TRIANGLE | minor | warn_only |
| GEOMETRY_ROOF_WALL_GAP | major | strip_detail |
| GEOMETRY_INVALID_INSET | major | strip_detail |
| GEOMETRY_Z_FIGHTING_RISK | minor | warn_only |

### REALITY_* (8)
| Code | Severity | Action |
|------|----------|--------|
| REALITY_OBSERVED_RATIO_LOW | major | downgrade_tier |
| REALITY_INFERRED_RATIO_HIGH | minor | warn_only |
| REALITY_DEFAULTED_RATIO_HIGH | major | downgrade_tier |
| REALITY_FACADE_COVERAGE_LOW | major | strip_detail |
| REALITY_HEIGHT_CONFIDENCE_LOW | minor | warn_only |
| REALITY_MATERIAL_CONFIDENCE_LOW | minor | warn_only |
| REALITY_PLACEHOLDER_RATIO_HIGH | major | downgrade_tier |
| REALITY_PROCEDURAL_DECORATION_HIGH | info | record_only |

### DCC_GLB_* (13)
| Code | Severity | Action |
|------|----------|--------|
| DCC_MATERIAL_MISSING | critical | fail_build |
| DCC_GLB_DUPLICATE_NODE_ID | critical | fail_build |
| DCC_GLB_INVALID_PIVOT | critical | fail_build |
| DCC_GLB_ORPHAN_NODE | critical | fail_build |
| DCC_GLB_PARENT_CYCLE | critical | fail_build |
| DCC_GLB_EMPTY_NODE | critical | fail_build |
| DCC_GLB_INDEX_OUT_OF_RANGE | critical | fail_build |
| DCC_GLB_BINARY_HASH_MISMATCH | critical | fail_build |
| DCC_GLB_VALIDATOR_ERROR | critical | fail_build |
| DCC_GLB_ACCESSOR_MINMAX_INVALID | critical | fail_build |
| DCC_GLB_INVALID_TRANSFORM | critical | fail_build |
| DCC_GLB_BOUNDS_INVALID | critical | fail_build |
| DCC_GLB_PRIMITIVE_POLICY_VIOLATION | major | warn_only |

### REPLAY_* (4)
| Code | Severity | Action |
|------|----------|--------|
| REPLAY_MANIFEST_ARTIFACT_MISMATCH | critical | fail_build |
| REPLAY_INPUT_HASHES_COMPLETE | minor | warn_only |
| REPLAY_SNAPSHOT_BUNDLE_ID_MISSING | critical | fail_build |
| REPLAY_CORE_METRIC_DRIFT | major | warn_only |

## 3. Reality Tier Downgrade 규칙

| 현재 Tier | Major Issue 조건 | 하락 Tier |
|-----------|-----------------|-----------|
| REALITY_TWIN | observed_ratio < 0.3 | STRUCTURAL_TWIN |
| STRUCTURAL_TWIN | inferred_ratio > 0.5 | PROCEDURAL_MODEL |
| PROCEDURAL_MODEL | placeholder_ratio > 0.5 | PLACEHOLDER_SCENE |
| PLACEHOLDER_SCENE | - | 하락 불가 (최하위) |

## 4. Gate Decision Flow

```
QA Gate evaluate()
├── critical + fail_build → FAILED (build 차단)
├── major + downgrade_tier → tier 1단계 하락
├── major + strip_detail → geometry 제거 후 재평가
├── minor → warn_only (manifest 기록)
└── info → record_only (audit 기록)
```
