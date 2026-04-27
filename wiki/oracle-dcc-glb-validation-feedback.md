# Oracle Feedback: DCC / GLB Validation

This page records the architectural guidance used for the validation-first path.
The docs under `docs/` remain the source of truth.

## Decision

- Keep validation outside the compiler.
- Validate after compile and before `COMPLETED`.
- Treat manifest / artifact mismatch as a critical build failure.
- Keep DCC hierarchy rules explicit instead of repairing them silently.
- Allow glTF extras or a sidecar manifest only as a documented contract.
- Do not close Phase 19 until real GLB bytes and byte-level validation exist.

## Required Validation Surface

- manifest ↔ artifact identity
- final tier consistency
- QA summary consistency
- mesh plan hierarchy integrity
- material reference integrity
- pivot validity
- node cycle/orphan detection

## Metadata Contract

- root `asset.extras.worMap` is the preferred target for stable build metadata
- sidecar export is the escape hatch when payload size or policy requires it
- no provider raw schema in the exported metadata

## Implementation Order

1. freeze contracts and registry codes
2. validate manifest / artifact consistency
3. add DCC hierarchy gates
4. add extras or sidecar export
5. replace the GLB stub with real GLB bytes

## Test Strategy

- reject manifest / artifact mismatches
- reject invalid hierarchy and missing material references
- reject placeholder output paths that cannot satisfy the validation contract
- verify completed builds only happen after validation passes
