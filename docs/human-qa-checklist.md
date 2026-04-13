# Human QA Checklist (Phase 11)

## 목적

자동 QA 결과와 별개로, 사람이 직접 검토해야 하는 DCC/semantic/editability 항목을 고정한다.

## 체크 항목

1. **DCC Hierarchy**
   - root/category/building-group 구조가 유지되는가
   - orphan node가 없는가

2. **Pivot & Editability**
   - building group node에 pivot metadata가 있는가
   - Blender import 후 개별 building 편집이 가능한가

3. **Semantic Traceability**
   - node/mesh/primitive extras에 `objectId`, `semanticCategory`, `sourceSnapshotIds`가 존재하는가
   - twin entity 매핑이 누락되지 않았는가

4. **State Binding Granularity**
   - scene-level + entity-level state channel이 모두 존재하는가
   - entity state API 필터(kind/objectId)가 기대대로 동작하는가

5. **Reproducibility Spot-check**
   - 동일 입력(sceneId/query/scale) 재생성 시 핵심 지표(entityCount, evidenceCount, state binding count)가 일치하는가

## 판정

- PASS: 치명 항목(1,2,3,4) 모두 충족
- WARN: 비치명 항목(5)만 일부 불일치
- FAIL: 치명 항목 중 1개 이상 불충족
