# DCC / GLB Validation

## Purpose

WorMap v2 must reject invalid DCC/GLB output before a build is marked `COMPLETED`.
Validation is a hard gate, not a hinting layer.

## Source of Truth

- PRD v2.3 §19.1: GLB Validation Pipeline
- PRD v2.3 §20: QA Severity & Gate Control
- PRD v2.3 §23.2: MVP Quality Criteria
- `docs/04-quality/dcc-glb-validation.md`

## Validation Order

1. Build `MeshPlan`
2. Compile GLB artifact
3. Validate artifact metadata and DCC hierarchy
4. Validate manifest ↔ artifact consistency
5. Publish `COMPLETED` only if all critical checks pass

## Hard Gates

- empty node with no children = 0
- parent pivot missing count = 0
- critical glTF validator error = 0
- manifest / artifact mismatch = fail build

## Severity Model

- `critical` → `fail_build`
- `major` → `downgrade_tier` or `strip_detail`
- `minor` → `warn_only`
- `info` → `record_only`

## DCC Checks

### Node Hierarchy

- every MeshPlan node must map to exactly one glTF node
- parent references must resolve to an existing node
- no orphan nodes
- no cycles
- no extra implicit hierarchy nodes unless explicitly declared by contract

### Pivot Policy

- every renderable node must have a finite pivot
- parent pivot must be preserved in the emitted DCC hierarchy
- missing or non-finite pivot is critical

### Material Integrity

- every node.materialId must resolve to a declared material
- unresolved material references are critical

### Validator Checks

- node transform must not contain `NaN` or `Infinity`
- accessors must have valid min/max bounds
- index buffers must stay within range
- material/texture references must resolve
- childless empty nodes are forbidden

## Failure Behavior

If validation fails after artifact generation:

- do not mark the build `COMPLETED`
- keep the artifact quarantined or fail the build
- preserve the diagnostic report for replay and audit

## Non-Goals

- Do not repair geometry in the GLB compiler
- Do not trust placeholder hashes as production metadata
- Do not silence DCC validation failures as warnings
