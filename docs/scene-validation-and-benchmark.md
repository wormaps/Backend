# Scene Validation and Benchmark

이 문서는 현재 WorMap 백엔드의 검증 방식과 성능 측정 진입점을 정리한다.

## 1. 검증 원칙

- 테스트 코드는 `test/` 디렉터리만 사용한다.
- `src/` 내부에는 테스트를 두지 않는다.
- 통합 검증은 실제 앱 wiring을 최대한 유지한다.
- 벤치마크는 결과를 수집하는 진입점으로 두고, 수치는 실행 환경별로 따로 기록한다.

## 2. 현재 검증 구성

### 통합 테스트

- 파일: [`test/scene.integration.spec.ts`](/Users/user/wormapb/test/scene.integration.spec.ts)
- 범위:
  - 씬 생성
  - 조회
  - GLB 다운로드
  - 동일 씬 재생성
  - 동시 요청 처리
  - 외부 API 실패 경로

### 성능 벤치마크

- 실행: `bun run bench:scene`
- 스크립트: [`scripts/scene-benchmark.ts`](/Users/user/wormapb/scripts/scene-benchmark.ts)
- 입력 환경 변수:
  - `SCENE_BENCH_QUERY`
  - `SCENE_BENCH_SCALE`
  - `SCENE_BENCH_ITERATIONS`
  - `SCENE_BENCH_CONCURRENCY`

예시:

```bash
bun run bench:scene
SCENE_BENCH_QUERY="Seoul City Hall" SCENE_BENCH_ITERATIONS=3 bun run bench:scene
```

## 3. 측정 항목

- `createScene` 소요 시간
- `waitForIdle` 소요 시간
- 전체 처리 시간
- 프로세스 메모리 사용량
- 동시 요청 배치 처리 결과

## 4. 문서 기준

- Phase 6.2는 벤치 실행 진입점을 제공하는 단계다.
- 실제 목표치 충족 여부는 운영 환경에서 별도 측정 결과로 판단한다.
- Phase 6.3는 이 문서와 README의 검증 섹션을 기준으로 삼는다.
