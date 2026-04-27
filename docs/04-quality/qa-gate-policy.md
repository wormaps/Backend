# QA Gate Policy

QA는 리포트가 아니라 build 제어 로직이다.

## Action

- critical + fail_build: build failed
- major + downgrade_tier: final tier downgrade
- major + strip_detail: RenderIntent 재생성
- minor: warn
- info: record only

## 금지

- critical issue를 warn으로 낮추지 않는다.
- QA 실패 GLB를 active artifact로 공개하지 않는다.

## 관련 문서

- [QA Gate Decision Matrix](./qa-gate-decision-matrix.md) — 49개 Issue Code의 Severity/Action 매핑 및 Tier Downgrade 규칙
