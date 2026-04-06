# Scene Generation Policy

## Core Priorities

1. Preserve input structure before adding decoration.
2. Preserve road and crossing readability around the scene center.
3. Emphasize representative landmarks through metadata, not place-specific mesh code.
4. Add facade and signage detail only when it does not distort structure.

## Prohibited

- Place-name based geometry branching
- City-specific mesh builders
- Hardcoded color or massing logic tied to a single place
- Metadata that directly dictates mesh strategy for a specific place

## Allowed

- Landmark annotation manifests
- Landmark classification and importance metadata
- Placement hints for signage clusters and furniture rows
- Fallback heuristics derived from geometry, usage, road class, and proximity

## Fidelity Target

- Structural fidelity is the primary target for every place.
- The center core should preserve most buildings and road continuity.
- Facade and signage fidelity are secondary and must degrade gracefully when evidence is weak.
