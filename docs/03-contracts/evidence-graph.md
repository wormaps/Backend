# Evidence Graph Contract

Evidence Graph는 source와 entity/property 사이의 근거 연결망이다.

## 역할

- observed support 기록
- inferred derivation 기록
- defaulted reason 기록
- source conflict 기록

## 규칙

- observed property는 `supports` edge가 필요하다.
- inferred property는 `derived_from` edge가 필요하다.
- conflict는 `contradicts` edge로 남긴다.
