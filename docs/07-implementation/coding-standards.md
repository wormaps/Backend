# Coding Standards

## Type First

- runtime 로직보다 contract type을 먼저 만든다.
- public contract는 문서와 테스트를 같이 추가한다.

## Imports

- contracts는 provider SDK를 import하지 않는다.
- GLB compiler는 provider, confidence, provenance 생성 코드를 import하지 않는다.

## Testing

- schema snapshot test로 public contract를 고정한다.
- adversarial fixture가 expected QA code를 내는지 검증한다.
