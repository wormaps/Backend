# SourceSnapshot Contract

`SourceSnapshot`은 provider 응답이 pipeline에 들어오는 유일한 형태다.

## 저장 모드

- `none`
- `metadata_only`
- `ephemeral_payload`
- `cached_payload`

## 필수

- provider
- sceneId
- queryHash
- status
- compliance policy

## 규칙

- raw payload 저장 여부는 provider policy가 결정한다.
- replay 가능성과 compliance 가능성을 같은 계약에서 표현한다.
