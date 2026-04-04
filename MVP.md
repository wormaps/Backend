# WorMap

시간·날씨·인파·교통 상태를 반영한 장소를 3D로 탐색하고 재생할 수 있는 디지털 트윈 기반 월드 시뮬레이션 프로젝트.

---

# 1. 프로젝트 한 줄 소개

WorMap은 3D 지구본에서 특정 장소를 선택하면, 해당 장소를 시간·날씨·교통·인파 상태까지 반영한 Place Scene으로 진입해 탑뷰와 워크뷰로 탐색할 수 있는 웹 기반 시뮬레이션 프로젝트이다.

---

# 2. 프로젝트 목적

대부분의 지도 서비스는 위치 정보와 정적인 거리 뷰만 제공한다.

하지만 실제 장소는 시간대, 날씨, 사람 수, 차량 흐름에 따라 분위기와 움직임이 달라진다.

WorMap은 이러한 요소를 단순한 지도 정보가 아닌, “움직이는 장소”로 보여주는 것을 목표로 한다.

예를 들어:

* 비 오는 밤의 시부야 스크램블

* 퇴근 시간대의 강남역

* 주말 낮의 타임스퀘어

* 새벽 시간의 광화문 광장

처럼 같은 장소라도 다른 시간과 상태에 따라 완전히 다른 장면으로 표현할 수 있다.

---

# 3. 핵심 기능

## 3-1. 3D 지구본 탐색

* 사용자는 3D 지구본에서 국가, 도시, 장소를 탐색할 수 있다.

* 줌인 시 장소 포인트가 표시된다.

* 장소를 클릭하면 Place Scene으로 진입할 수 있다.

예시:

* Shibuya Crossing

* Times Square

* Gangnam Station

* Gwanghwamun Square

## 3-2. Place Scene 진입

* 장소를 클릭하면 Loading Scene으로 전환된다.

* 이후 해당 장소가 탑뷰 기준으로 렌더링된다.

* 장소의 크기와 구조는 고정된 상태로 제공된다.

## 3-3. 시간 반영

* 사용자는 특정 시간대를 선택할 수 있다.

* 낮 / 저녁 / 밤에 따라 조명과 분위기가 달라진다.

* 야간에는 네온사인, 차량 라이트, 건물 조명이 활성화된다.

## 3-4. 날씨 반영

* 맑음 / 흐림 / 비 / 눈 상태를 지원한다.

* 비가 오면 도로 반사, 우산, 젖은 바닥 등을 표현할 수 있다.

* 눈이 오는 경우 입자 효과와 지면 변화 등을 적용할 수 있다.

## 3-5. 인파 및 차량 흐름

* 장소 타입, 시간대, 날씨, 교통량에 따라 사람 수와 차량 수가 달라진다.

* 횡단보도, 보행로, 차선 기준으로 이동 경로를 생성한다.

* 배속 기능으로 24시간 흐름을 빠르게 확인할 수 있다.

## 3-6. 탑뷰 / 워크뷰

* 기본 진입은 탑뷰 기준이다.

* 사용자는 워크뷰로 전환해 WASD로 장소 내부를 걸어다닐 수 있다.

* 장소의 분위기와 움직임을 직접 체험할 수 있다.

---

# 4. 주요 사용자 흐름

```text

1. 사용자가 WorMap 접속

2. 3D 지구본 렌더링

3. 사용자가 특정 지역으로 줌인

4. 장소 포인트 표시

5. 장소 클릭

6. Loading Scene 진입

7. 장소 데이터 로딩

8. Place Scene 렌더링

9. 시간 / 날씨 / 배속 / 탑뷰 / 워크뷰 사용

10. 다시 지구본으로 복귀

```

---

# 5. 프로젝트 구조

## Frontend

### Globe Scene

* 3D 지구본 렌더링

* 장소 포인트 표시

* 장소 선택

### Loading Scene

* 장소 생성 진행 상황 표시

* 툴팁 표시

* 장면 로딩 연출

### Place Scene

* 탑뷰 렌더링

* 워크뷰 렌더링

* 날씨 / 시간 / 인파 / 차량 재생

---

## Backend

### Place Registry

* 지원하는 장소 목록 관리

* place id, 이름, 좌표, 카테고리 관리

### Scene Builder

* 장소 데이터를 기반으로 scene data 생성

* 도로, 건물, 보행로, POI 구조 생성

* 이동 경로 및 nav data 생성

### Snapshot Builder

* 시간대, 날씨, 인파, 차량 상태 계산

* 특정 시점의 장소 상태 생성

### Asset Cache

* 생성된 장소 데이터를 저장

* 동일 장소는 재사용

---

# 6. 데이터 구조

장소 하나는 크게 3개의 데이터로 구성된다.

```text

Place

 ├─ Registry Info

 ├─ Place Package

 └─ Scene Snapshot

```

## 6-1. Registry Info

* 장소 이름

* 위도 / 경도

* 국가 / 도시

* 장소 타입

## 6-2. Place Package

* 건물 구조

* 도로 구조

* 보행로 구조

* 카메라 위치

* 워크뷰 시작점

* 랜드마크 위치

## 6-3. Scene Snapshot

* 시간대

* 날씨

* 사람 수

* 차량 수

* 조명 상태

* 도로 상태

---

# 7. 사용 예정 기술 스택

## Frontend

* React

* TypeScript

* Three.js

* React Three Fiber

* Drei

* Zustand

* Framer Motion

* Tailwind CSS

## Globe / Map

* Cesium

* CesiumJS

* OpenStreetMap

## Backend

* Node.js

* NestJS 또는 Express

* PostgreSQL

* Redis

* Prisma

## Scene / Asset

* GLTF / GLB

* Three.js Geometry

* Custom Scene JSON

## API

* Google Places API

* OpenStreetMap + Overpass API

* Open-Meteo Historical Weather API

* TomTom Traffic API

---

# 8. MVP 범위

초기 MVP는 모든 기능을 다 구현하지 않는다.

우선 다음 범위만 구현한다.

## MVP 기능

* 3D 지구본

* 미리 등록된 장소 3개

* 장소 클릭

* Loading Scene

* Place Scene 렌더링

* 탑뷰 / 워크뷰

* 낮 / 밤 반영

* 비 / 맑음 반영

* 차량 / 인파 소규모 이동

* 정지 / 재생 / 배속

## MVP 대상 장소 예시

* Shibuya Crossing

* Times Square

* Gangnam Station

---

# 9. 예상 어려움

## 9-1. 인파 자연스러움

* 벽을 뚫고 지나갈 수 있음

* 서로 겹칠 수 있음

* 모든 사람이 동일하게 보일 수 있음

* 이동 패턴이 부자연스러울 수 있음

해결 방향:

* Path 기반 이동

* NavMesh 적용

* 다양한 모델과 랜덤 애니메이션 적용

* 시간대별 crowd preset 구성

## 9-2. 성능 문제

* 건물 수가 많아질 수 있음

* 차량과 사람이 많아질 수 있음

* 렌더링 부하가 커질 수 있음

해결 방향:

* LOD

* Instancing

* Frustum Culling

* 거리 기반 비활성화

* Place Package 캐싱

## 9-3. API 의존성

* 장소마다 데이터 품질 차이가 있음

* 일부 지역은 교통 데이터가 부족할 수 있음

* API 비용과 제한이 있을 수 있음

해결 방향:

* 장소별 지원 범위 제한

* 사전 생성 및 캐싱

* Scene Fallback 데이터 준비

---

# 10. 프로젝트 의의

WorMap은 단순 지도 서비스가 아니라,

“특정 시간과 분위기의 장소를 재생할 수 있는 디지털 월드 플레이어”를 목표로 한다.

이 프로젝트는 단순 CRUD 중심 프로젝트와 달리:

* 3D 렌더링

* 시뮬레이션

* 지도 데이터

* 외부 API 통합

* 상태 기반 월드 구성

* 최적화

를 함께 다루는 포트폴리오 프로젝트로 활용할 수 있다.

특히 “실제 장소를 움직이는 장면으로 재구성한다”는 점에서 차별성이 있다.
