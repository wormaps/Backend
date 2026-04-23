# Pipeline Lifecycle

## 단계

1. Build request admission
2. Snapshot collection
3. Normalization
4. Evidence graph build
5. Twin scene graph build
6. Render intent resolution
7. Mesh planning
8. GLB build
9. QA gate
10. Manifest finalization

## 재시도 원칙

- provider retry는 snapshot 단계에만 둔다.
- normalization 이후 단계는 이전 artifact를 보존하고 재실행한다.
- QA 실패 GLB는 `QUARANTINED` 상태로만 저장할 수 있다.
