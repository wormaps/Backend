# Geometry Validation

## Building Footprint

- closed ring
- orientation normalization
- duplicate vertex removal
- degenerate edge removal
- minimum area
- self-intersection check
- hole containment check

## Conflict

- IoU > 0.85: duplicate merge
- 0.25 < IoU <= 0.85: conflict
- IoU <= 0.25: independent

## 금지

- conflict를 height stagger로 숨기지 않는다.
