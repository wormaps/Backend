# Mesh Plan Intent Projection

## Problem
`MeshPlanBuilderService`가 빈 node/material만 만들고 있어서 QA와 GLB 단계가 render policy를 실제로 소비하지 못했다.

## Change
- `MeshPlanBuilderService`는 이제 `TwinSceneGraph + RenderIntentSet`을 함께 받는다
- `excluded` intent는 node를 만들지 않는다
- entity type과 visual mode를 조합해 primitive/material role을 결정한다
- material은 role 단위로 공유한다

## Current Mapping
- building -> `building_massing`
- road / traffic_flow -> `road`
- walkway -> `walkway`
- terrain -> `terrain`
- poi -> `poi_marker`

## Limits
- 아직 parent hierarchy, batching, instancing은 없다
- structural detail과 landmark asset은 primitive 분기가 없다
- geometry 자체는 여전히 placeholder 좌표다
