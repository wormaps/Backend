# RenderIntentSet Contract

`RenderIntentSet`은 fact model을 render policy로 변환한 결과다.

## visualMode

- massing
- structural_detail
- landmark_asset
- traffic_overlay
- placeholder
- excluded

## 규칙

- contextArea entity는 기본 massing이다.
- conflict entity는 placeholder 또는 excluded다.
- facade/roof detail은 confidence threshold를 통과해야 한다.
