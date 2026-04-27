# Scene Scope Contract

`SceneScope`는 품질과 비용의 첫 번째 제어점이다.

## 필드

- center
- boundaryType
- radiusMeters 또는 polygon
- focusPlaceId
- coreArea
- contextArea
- exclusionAreas

## 정책

- coreArea는 자동 축소하지 않는다.
- contextArea는 preflight budget 초과 시 축소 가능하다.
- coreArea 밖 detail은 기본적으로 제한한다.
