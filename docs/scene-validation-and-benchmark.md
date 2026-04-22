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
- 하네스 계획 파일: [`scripts/scene-benchmark.plan.ts`](/Users/user/wormapb/scripts/scene-benchmark.plan.ts)
- 입력 환경 변수:
  - `SCENE_BENCH_PROFILE`
  - `SCENE_BENCH_QUERY`
  - `SCENE_BENCH_SCALE`
  - `SCENE_BENCH_ITERATIONS`
  - `SCENE_BENCH_CONCURRENCY`
  - `SCENE_BENCH_CONCURRENCY_LIMIT`
  - `SCENE_BENCH_OUTPUT_PATH`

예시:

```bash
bun run bench:scene
SCENE_BENCH_QUERY="Seoul City Hall" SCENE_BENCH_ITERATIONS=3 bun run bench:scene
SCENE_BENCH_PROFILE=phase6-load bun run bench:scene
```

## 3. 측정 항목

- `createScene` 소요 시간
- `waitForIdle` 소요 시간
- 전체 처리 시간
- 프로세스 메모리 사용량
- 동시 요청 배치 처리 결과
- `scene_queue_depth`와 같은 metrics snapshot
- `statusCounts`로 READY / FAILED / PENDING 결과 집계
- `data/benchmark/scene-benchmark-report.json` 또는 `SCENE_BENCH_OUTPUT_PATH`로 지정한 JSON report

## 4. Scale Gate 측정 기준

Phase 6.3의 load fixture는 다음 기준으로 scale gate를 측정하고 기록한다.

### 4.1 Concurrency clamping

- 각 fixture의 `requestedConcurrency`는 `SCENE_BENCH_CONCURRENCY_LIMIT`로 clamp된다.
- `effectiveConcurrency = Math.min(requestedConcurrency, concurrencyLimit)`
- 동시 배치 테스트에서 `uniqueSceneIds`가 `effective`와 일치해야 고유 scene 생성이 보장된다.

### 4.2 Memory snapshot

- 각 샘플마다 `rssMb`와 `heapUsedMb`를 기록한다.
- report의 `aggregate.rssMb` / `aggregate.heapUsedMb`에 min/max/avg가 집계된다.
- `metricsSnapshot`에는 `scene_queue_depth` 등 Prometheus metric의 현재 값이 포함된다.

### 4.3 Status 집계

- `statusCounts`는 모든 샘플의 상태를 `ready / failed / pending / other`로 분류한다.
- `READY`가 아닌 샘플은 `failureReason`과 `failureCategory`를 기록한다.

### 4.4 Output 계약

- Report JSON은 `data/benchmark/scene-benchmark-report.json`에 기록된다.
- `SCENE_BENCH_OUTPUT_PATH`로 경로를 변경할 수 있다.
- Report는 `generatedAt`, `mode`, `profile`, `statusCounts`, `cases`, `aggregate`, `metricsSnapshot`을 포함한다.

## 5. 문서 기준

- Phase 6.2는 벤치 실행 진입점을 제공하는 단계다.
- Phase 6.3는 load fixture profile과 report output까지 포함한 하네스 단계다.
- 실제 목표치 충족 여부는 운영 환경에서 별도 측정 결과로 판단한다.
- Phase 6.3는 이 문서와 README의 검증 섹션을 기준으로 삼는다.

## 6. 현재 측정 결과

### Stubbed mode

- Query: `Seoul City Hall`
- Scale: `MEDIUM`
- Iterations: `1`
- Concurrency: `2`

Observed values:

- `createSceneMs`: `8.78ms`
- `waitForIdleMs`: `147.72ms`
- `totalMs`: `156.50ms`
- `rssMb`: `218.25MB`
- `heapUsedMb`: `30.94MB`
- concurrent batch `totalMs`: `71.54ms`
- concurrent batch `uniqueSceneIds`: `1`

### Phase 6 load fixture

- Profile: `phase6-load`
- Fixture cases:
  - `Seoul City Hall`
  - `Shibuya Scramble Crossing, Tokyo`
  - `Akihabara, Tokyo`
- Concurrency is bounded by `SCENE_BENCH_CONCURRENCY_LIMIT`
- Output JSON is written to `data/benchmark/scene-benchmark-report.json` unless overridden

### Live mode

- 현재 로컬 환경에서는 Google Places 요청 실패로 live benchmark가 완료되지 않았다.
- 따라서 위 수치는 stubbed mode 기준이며, 운영 환경 live 재측정이 필요하다.

## 7. Akihabara run

### Generation

- Script: [`scripts/run-akihabara-scene.ts`](/Users/user/wormapb/scripts/run-akihabara-scene.ts)
- Result: `FAILED`
- Failure reason: `Google Places Text Search 요청에 실패했습니다.`

### Benchmark

- Mode: `stubbed`
- Query: `Akihabara, Tokyo`
- Iterations: `1`
- Concurrency: `1`

Observed values:

- `createSceneMs`: `7.93ms`
- `waitForIdleMs`: `170.19ms`
- `totalMs`: `178.12ms`
- `rssMb`: `216.59MB`
- `heapUsedMb`: `30.95MB`
