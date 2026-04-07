# Plan: District/Cluster 단위 Facade Material Profile 확장

## 1. 목표

현실 도시의 시각적 다양성을 반영하기 위해, 현재 **scene-wide facadeMaterialProfile**을 확장하여 **district/cluster 단위**의 facade profile을 추가한다.

이를 통해:

- 같은 scene 안에서도 상업지/주거지/오피스/랜드마크 주변의 재질 언어가 달라짐
- building별 초세분화가 아닌, **중간 단위(district/cluster)**로 효율적 분류
- Mapillary evidence를 활용한 증거 기반 분류

## 2. 핵심 설계 원칙

### 2.1 현실 객체 전체를 type화하지 않는다

- 현실의 모든 건물 유형을 세밀하게 정의하면 엔진이 아니라 "도시 사전"이 됨
- 대신 **렌더 결과에 큰 영향을 주는 시각적 archetype만 계층화**

### 2.2 표현 규칙을 type화한다

- "건물의 실제 정체성"을 다 맞추는 게 아니라
- 렌더링에 필요한 표현 요소만 구조화

### 2.3 3단계 구조

```
scene-wide base profile
  └─ district/cluster override
      └─ hero building override
```

## 3. 타입 확장 (사용자 제안 기반)

### 3.1 Material Family/Variant (중앙화)

**파일**: `src/scene/types/scene-domain.types.ts`

```ts
export type MaterialFamily =
  | 'glass'
  | 'concrete'
  | 'panel'
  | 'brick'
  | 'metal'
  | 'mixed';

export type MaterialVariant =
  | 'glass_cool_light'
  | 'glass_cool_dark'
  | 'concrete_residential_beige'
  | 'concrete_old_gray'
  | 'panel_retail_white'
  | 'panel_retail_dark'
  | 'brick_lowrise_red'
  | 'metal_station_silver'
  | 'mixed_neutral_light';
```

### 3.2 Facade Pattern

```ts
export type FacadePattern =
  | 'curtain_wall'
  | 'vertical_mullion'
  | 'horizontal_bands'
  | 'repetitive_windows'
  | 'balcony_stack'
  | 'sign_band'
  | 'blank_wall_heavy';
```

### 3.3 Roof Style (기존 RoofType 확장)

```ts
export type RoofStyle =
  | 'flat'
  | 'setback'
  | 'gable'
  | 'mechanical_heavy'
  | 'podium_tower';
```

### 3.4 Evidence Strength

```ts
export type EvidenceStrength = 'none' | 'weak' | 'medium' | 'strong';
```

### 3.5 Building Facade Profile (종합)

```ts
export interface BuildingFacadeProfile {
  family: MaterialFamily;
  variant: MaterialVariant;
  pattern: FacadePattern;
  roofStyle: RoofStyle;
  evidence: EvidenceStrength;
  emissiveBoost?: number;
  signDensity?: 'low' | 'medium' | 'high';
}
```

### 3.6 District Cluster (SceneFacadeContextProfile 확장)

**기존**: `SceneFacadeContextProfile` (NEON_CORE, COMMERCIAL_STRIP, TRANSIT_HUB, CIVIC_CLUSTER, RESIDENTIAL_EDGE)

**확장**: 새 필드 `districtCluster` 추가

```ts
export type DistrictCluster =
  | 'core_commercial'
  | 'secondary_commercial'
  | 'office_mixed'
  | 'residential_midrise'
  | 'residential_lowrise'
  | 'landmark_zone';
```

### 3.7 District Profile

```ts
export interface DistrictFacadeProfile {
  districtCluster: DistrictCluster;
  facadeProfile: BuildingFacadeProfile;
  confidence: number; // 0~1, cluster 분류 신뢰도
}
```

## 4. 구현 단계

### Phase 1: 타입 정의 및 중앙화

**목표**: 새 타입을 `scene-domain.types.ts`에 추가하고, 기존 타입과 호환성 유지

**파일 변경**:

- `src/scene/types/scene-domain.types.ts` - 새 타입 추가
- `src/scene/types/scene-model.types.ts` - `SceneFacadeHint`에 `districtCluster` 필드 추가

**제약**:

- LOC 500 이하 유지
- 기존 필드 삭제 금지 (확장만)
- Logger 사용

**Deliverable**:

- 새 타입 정의 완료
- 기존 코드와 호환성 검증 (type-check 통과)

---

### Phase 2: District Cluster 분류 로직

**목표**: building을 district/cluster로 분류하는 로직 구현

**새 파일**: `src/scene/services/vision/scene-facade-district.utils.ts`

**분류 기준** (우선순위):

1. 교차로 중심 반경 (기존 `contextProfile` 활용)
2. 도로 등급 (arterial vs local)
3. 상업 POI 밀도
4. building height 밀도
5. landmark 근접도
6. Mapillary feature density (추후 확장)

**분류 로직**:

```ts
function resolveDistrictCluster(
  building: SceneBuildingMeta,
  context: SceneFacadeContext,
  facadeHint: SceneFacadeHint,
): DistrictCluster {
  // 1. 기존 contextProfile 기반 1차 분류
  // 2. building.preset, usage, height 기반 세분화
  // 3. 근접 landmark 여부
  // 4. 최종 cluster 결정
}
```

**제약**:

- LOC 500 이하
- 중앙화 (shared utils)
- Logger로 분류 결과 기록

**Deliverable**:

- 분류 로직 구현
- 모든 facadeHint에 `districtCluster` 부여 확인

---

### Phase 3: District-Level Facade Profile 정의

**목표**: 각 district cluster에 대한 facade profile 매핑 테이블 구현

**새 파일**: `src/assets/compiler/materials/district-facade-profiles.ts`

**프로파일 정의**:

```ts
const DISTRICT_FACADE_PROFILES: Record<DistrictCluster, BuildingFacadeProfile> =
  {
    core_commercial: {
      family: 'panel',
      variant: 'panel_retail_dark',
      pattern: 'sign_band',
      roofStyle: 'flat',
      evidence: 'strong',
      emissiveBoost: 1.3,
      signDensity: 'high',
    },
    secondary_commercial: {
      family: 'mixed',
      variant: 'mixed_neutral_light',
      pattern: 'repetitive_windows',
      roofStyle: 'flat',
      evidence: 'medium',
      emissiveBoost: 1.1,
      signDensity: 'medium',
    },
    office_mixed: {
      family: 'glass',
      variant: 'glass_cool_dark',
      pattern: 'curtain_wall',
      roofStyle: 'flat',
      evidence: 'medium',
      emissiveBoost: 0.9,
      signDensity: 'low',
    },
    residential_midrise: {
      family: 'concrete',
      variant: 'concrete_residential_beige',
      pattern: 'repetitive_windows',
      roofStyle: 'flat',
      evidence: 'medium',
      emissiveBoost: 0.7,
      signDensity: 'low',
    },
    residential_lowrise: {
      family: 'brick',
      variant: 'brick_lowrise_red',
      pattern: 'balcony_stack',
      roofStyle: 'gable',
      evidence: 'weak',
      emissiveBoost: 0.6,
      signDensity: 'low',
    },
    landmark_zone: {
      family: 'glass',
      variant: 'glass_cool_light',
      pattern: 'curtain_wall',
      roofStyle: 'setback',
      evidence: 'strong',
      emissiveBoost: 1.2,
      signDensity: 'medium',
    },
  };
```

**제약**:

- LOC 500 이하
- 중앙화
- Logger 사용

**Deliverable**:

- 프로파일 매핑 테이블
- cluster → profile 변환 함수

---

### Phase 4: Scene-Wide + District Profile 병합

**목표**: 기존 scene-wide facadeMaterialProfile에 district-level override를 적용

**파일 변경**:

- `src/assets/internal/glb-build/glb-build-facade-material-profile.utils.ts`

**병합 로직**:

```ts
function resolveBuildingFacadeProfile(
  sceneWideProfile: FacadeLayerMaterialProfile,
  districtProfile: BuildingFacadeProfile | null,
  facadeHint: SceneFacadeHint,
): BuildingFacadeProfile {
  // 1. scene-wide profile을 기본으로 사용
  // 2. district profile이 있으면 override
  // 3. facadeHint의 개별 building 데이터로 미세 조정
  // 4. 최종 profile 반환
}
```

**제약**:

- 기존 scene-wide 로직 유지
- district profile은 optional override
- LOC 500 이하

**Deliverable**:

- 병합 로직 구현
- building별 facade profile 다양성 확인

---

### Phase 5: Mapillary Evidence 강화 (선택적)

**목표**: Mapillary 데이터를 cluster 분류 및 profile 결정에 활용

**확장 포인트**:

1. `MapillaryClient.mapFeature`에서 feature type별 카운트 추가
2. `SceneFacadeVisionService`에서 feature density 계산 강화
3. `densityFromEvidence`에 feature type 가중치 추가

**파일 변경**:

- `src/places/clients/mapillary.client.ts` - feature type 매핑 확장
- `src/scene/services/vision/scene-facade-vision.service.ts` - density 계산 강화
- `src/scene/services/vision/scene-facade-vision.context.utils.ts` - cluster-aware weighting

**주의**:

- Mapillary는 "정답 색상 추출기"가 아닌 "evidence 공급원"
- signage density, material tendency, street object density 활용

**Deliverable**:

- Mapillary evidence 기반 cluster 분류 개선
- provenance에 feature family별 카운트 저장

---

### Phase 6: 검증 및 테스트

**목표**: 전체 파이프라인 검증

**검증 항목**:

1. `bun run type-check` 통과
2. `bun test` 50 pass
3. `bun run build` 통과
4. `bun run scene:shibuya` smoke READY
5. diagnostics에서 district cluster 분포 확인
6. building별 facade profile 다양성 확인

**Deliverable**:

- 검증 통과 확인
- 시부야 scene 재생성 및 결과 확인

## 5. 파일 변경 요약

| 파일                                                                       | 변경 유형 | 설명                                        |
| -------------------------------------------------------------------------- | --------- | ------------------------------------------- |
| `src/scene/types/scene-domain.types.ts`                                    | 확장      | 새 타입 추가                                |
| `src/scene/types/scene-model.types.ts`                                     | 확장      | `SceneFacadeHint.districtCluster` 필드 추가 |
| `src/scene/services/vision/scene-facade-district.utils.ts`                 | 신규      | district cluster 분류 로직                  |
| `src/scene/services/vision/scene-facade-vision.service.ts`                 | 수정      | district cluster 부여 로직 호출             |
| `src/assets/compiler/materials/district-facade-profiles.ts`                | 신규      | district별 facade profile 매핑              |
| `src/assets/internal/glb-build/glb-build-facade-material-profile.utils.ts` | 수정      | district profile 병합 로직                  |
| `src/places/clients/mapillary.client.ts`                                   | 확장      | feature type 매핑 강화 (Phase 5)            |

## 6. 제약 조건 준수

- **현재 아키텍처 및 모듈 준수**: 기존 pipeline 단계를 유지하고, 새 모듈만 추가
- **LOC 500 이상 안됨**: 각 파일을 500 LOC 이하로 유지, 필요시 분리
- **모든 로직은 중앙화**: shared utils로 분리
- **Logger 사용**: 분류 결과, profile 결정에 Logger 기록
- **CI/CD 가 쉬운 코드로직**: 타입 안전성, 테스트 용이성

## 7. 예상 효과

- 같은 scene 안에서도 **블록별 재질 언어 차이** 자연스럽게 표현
- 상업지역은 간판 밀집 + 발광 강화
- 주거지역은 차분한 콘크리트/벽돌
- 오피스 밀집 지역은 유리 커튼월
- 랜드마크 주변은 특화된 재질 언어

## 8. 리스크

1. **분류 오류**: cluster 분류가 틀리면 전체 재질이 잘못될 수 있음
   - 완화: confidence 기반 fallback (낮으면 scene-wide 사용)
2. **성능**: building별 cluster 분류 시 overhead
   - 완화: cluster별 프로파일 캐싱
3. **데이터 부족**: OSM/Mappillary 데이터가 부족한 지역
   - 완화: evidence strength 기반 fallback

## 9. 다음 단계

사용자 승인 후 Phase 1부터 구현 시작.
