# Failure Modes & Degraded Behavior

이 문서는 현재 파이프라인에서 실제로 발생 가능한 실패/부분성공(degraded) 경로를 코드 기준으로 정리합니다.

## 1) Google Places API Key 누락 (Hard Fail)

- 조건: `GOOGLE_API_KEY` 미설정
- 코드: `src/places/clients/google-places.client.ts#getApiKey`
- 동작:
  - `EXTERNAL_API_NOT_CONFIGURED`
  - Scene 생성 실패(`GENERATION_ERROR`) 경로로 이동
- 운영 가이드:
  - 서버 시작 전 `GOOGLE_API_KEY` 필수 검증
  - CI/배포 시 missing env를 즉시 fail 처리

## 2) Mapillary 토큰 누락/불안정 (Degraded 허용)

- 조건: `MAPILLARY_ACCESS_TOKEN` 미설정 또는 요청 실패
- 코드:
  - 설정 체크: `src/places/clients/mapillary.client.ts#isConfigured`
  - 비설정 시: 빈 images/features 반환
  - 비정상 응답/타임아웃: `src/common/http/fetch-json.ts` 예외
  - 상위 처리: `src/scene/services/vision/scene-vision.service.ts`
- 동작:
  - Mapillary 미설정: `detailStatus`는 최소 `OSM_ONLY` 또는 `PARTIAL`
  - Mapillary 호출 실패(catch): `detailStatus='PARTIAL'`로 degrade
  - Scene 자체는 계속 생성 가능(완전 fail 아님)

## 3) 외부 API 요청 실패/응답 파싱 실패 (Retry 대상)

- 코드: `src/common/http/fetch-json.ts`
- 실패 유형:
  - 네트워크 실패/timeout
  - upstream non-2xx
  - JSON 파싱 불가
- 동작:
  - `EXTERNAL_API_REQUEST_FAILED`
  - `SceneGenerationService`에서 `GENERATION_ERROR`로 분류
  - 최대 시도 전까지 retry, 초과 시 `FAILED`

## 4) Quality Gate 실패 (Non-Retry Fail)

- 코드:
  - 평가: `src/scene/services/generation/scene-quality-gate.service.ts`
  - 상태 반영: `src/scene/services/generation/scene-generation.service.ts`
- 핵심 동작:
  - `qualityGate.state='FAIL'`이면 `failureCategory='QUALITY_GATE_REJECTED'`
  - 이 경우 재시도하지 않고 즉시 실패 상태로 고정
- 목적:
  - “구린 결과를 READY로 올리는” 경로 차단

## 5) PHASE_3 Oracle 승인 잠금

- 코드: `src/scene/services/generation/scene-quality-gate.service.ts#resolveOracleApproval`
- 조건:
  - `PHASE_3_PRODUCTION_LOCK`에서
  - `${SCENE_DATA_DIR}/${sceneId}.oracle-approval.json` 파일 필요
- 동작:
  - 파일 누락/파싱실패/REJECTED -> `ORACLE_APPROVAL_REQUIRED` reason code
  - 승인 전 READY 불가

## 6) 현재 품질 병목(실행 관찰)

- 최근 `scene:shibuya` smoke에서 실패 원인:
  - `CRITICAL_BUDGET_SKIP`
- diagnostics 기준 직접 원인:
  - `building_windows` triangles 과다(수백만 단위)
- 의미:
  - 지금 실패의 본체는 API 키가 아니라 **window geometry budget 초과**

## 7) 운영 체크리스트

1. 필수 env
   - `GOOGLE_API_KEY` (필수)
   - `MAPILLARY_ACCESS_TOKEN` (권장, 없으면 degraded)
2. 생성 후 확인
   - `scene.status`
   - `scene.failureCategory`
   - `scene.qualityGate.reasonCodes`
   - `*.diagnostics.log`의 `glb_build`, `geometry_correction` 스테이지
3. 품질 실패 시
   - 무작정 retry하지 말고 `reasonCodes` 기반으로 원인 패치
