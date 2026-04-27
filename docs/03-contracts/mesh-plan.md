# MeshPlan Contract

`MeshPlan`은 GLB compiler 입력이다.

## 포함

- MeshPlanNode
- MaterialPlan
- MeshBudget

## 규칙

- empty node는 children이 있을 때만 생성한다.
- parent node는 실제 pivot transform을 가진다.
- MeshPlan은 geometry correction을 수행하지 않는다.
