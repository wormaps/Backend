# Reality Tier Policy

Reality Tier는 결과물을 얼마나 현실 디지털 트윈으로 주장할 수 있는지 나타내는 제품 품질 등급이다.

## Tier

- `REALITY_TWIN`: 핵심 구조와 외관 evidence가 충분하다.
- `STRUCTURAL_TWIN`: 구조 evidence는 충분하지만 외관 evidence는 제한적이다.
- `PROCEDURAL_MODEL`: 일부 구조 evidence와 많은 추정으로 구성된다.
- `PLACEHOLDER_SCENE`: fallback, demo, 진단용 산출물이다.

## 계산 시점

- initial candidate: `TwinSceneGraph` 생성 직후
- provisional: `RenderIntentSet` 생성 직후
- final: `QA Gate` 적용 후

## 금지

- procedural detail로 Reality Tier를 올리지 않는다.
- manual source alone으로 Reality Tier를 올리지 않는다.
- QA critical issue가 있으면 final tier를 확정하지 않는다.
