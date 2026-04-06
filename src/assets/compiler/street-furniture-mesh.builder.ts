import type { Coordinate } from '../../places/types/place.types';
import type { SceneStreetFurnitureDetail } from '../../scene/types/scene.types';
import {
  createEmptyGeometry,
  type GeometryBuffers,
  type Vec3,
} from './road-mesh.builder';

/**
 * 벤치 지오메트리 생성
 * - 좌석판, 등받이, 다리로 구성된 현실적인 벤치 모델
 * - variant에 따라 다양한 스타일 제공
 */
export function createBenchGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'BENCH') {
      continue;
    }
    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }
    const variant = stableVariant(item.objectId, 3);
    pushBenchAssembly(geometry, center, variant);
  }

  return geometry;
}

/**
 * 자전거 거치대 지오메트리 생성
 * - U자형 거치대 또는 그리드형 거치대
 */
export function createBikeRackGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'BIKE_RACK') {
      continue;
    }
    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }
    const variant = stableVariant(item.objectId, 2);
    pushBikeRackAssembly(geometry, center, variant);
  }

  return geometry;
}

/**
 * 쓰레기통 지오메트리 생성
 * - 원통형 본체와 뚜껑으로 구성
 */
export function createTrashCanGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'TRASH_CAN') {
      continue;
    }
    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }
    const variant = stableVariant(item.objectId, 2);
    pushTrashCanAssembly(geometry, center, variant);
  }

  return geometry;
}

/**
 * 소화전 지오메트리 생성
 * - 기둥형 본체와 사이드 노즐로 구성
 */
export function createFireHydrantGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'FIRE_HYDRANT') {
      continue;
    }
    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }
    pushFireHydrantAssembly(geometry, center);
  }

  return geometry;
}

/**
 * 개선된 가로등 지오메트리 생성 (다양한 디자인)
 * - 4가지 변형: 현대식, 클래식, 포스트탑, 월마운트 스타일
 */
export function createEnhancedStreetLightGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'STREET_LIGHT') {
      continue;
    }
    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }
    const variant = stableVariant(item.objectId, 4);
    pushEnhancedStreetLightAssembly(geometry, center, variant);
  }

  return geometry;
}

/**
 * 개선된 표지판 지오메트리 생성 (상세 패널 포함)
 * - 다양한 패널 크기와 모양
 * - 보조 패널 지원
 */
export function createEnhancedSignPoleGeometry(
  origin: Coordinate,
  items: SceneStreetFurnitureDetail[],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const item of items) {
    if (item.type !== 'SIGN_POLE') {
      continue;
    }
    const center = toLocalPoint(origin, item.location);
    if (!isFiniteVec3(center)) {
      continue;
    }
    const variant = stableVariant(item.objectId, 4);
    pushEnhancedSignPoleAssembly(geometry, center, variant);
  }

  return geometry;
}

// ============================================================================
// Assembly Functions
// ============================================================================

function pushBenchAssembly(
  geometry: GeometryBuffers,
  center: Vec3,
  variant: number,
): void {
  // 벤치 크기 (미터)
  const benchLength = 1.8;
  const benchWidth = 0.55;
  const seatHeight = 0.45;
  const backrestHeight = 0.85;
  const legHeight = 0.42;

  // 회전 각도 (variant에 따라)
  const rotation = (variant * Math.PI) / 2;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  // 좌석판 (상단)
  const seatHalfLength = benchLength / 2;
  const seatHalfWidth = benchWidth / 2;

  // 좌석 좌표 변환
  const corners = [
    [-seatHalfLength, -seatHalfWidth],
    [seatHalfLength, -seatHalfWidth],
    [seatHalfLength, seatHalfWidth],
    [-seatHalfLength, seatHalfWidth],
  ].map(([x, z]) => [
    center[0] + x * cos - z * sin,
    center[1] + seatHeight,
    center[2] + x * sin + z * cos,
  ]);

  pushBox(geometry, corners[0] as Vec3, corners[2] as Vec3);

  // 등받이 (뒷면)
  const backrestThickness = 0.06;
  const backrestY = seatHeight + (backrestHeight - seatHeight) / 2;
  const backrestCorners = [
    [-seatHalfLength, -seatHalfWidth - backrestThickness],
    [seatHalfLength, -seatHalfWidth - backrestThickness],
    [seatHalfLength, -seatHalfWidth],
    [-seatHalfLength, -seatHalfWidth],
  ].map(([x, z]) => [
    center[0] + x * cos - z * sin,
    center[1] + backrestY,
    center[2] + x * sin + z * cos,
  ]);

  // 등받이 높이까지 박스 추가
  const backrestTop = [
    [-seatHalfLength, -seatHalfWidth - backrestThickness],
    [seatHalfLength, -seatHalfWidth - backrestThickness],
    [seatHalfLength, -seatHalfWidth],
    [-seatHalfLength, -seatHalfWidth],
  ].map(([x, z]) => [
    center[0] + x * cos - z * sin,
    center[1] + backrestHeight,
    center[2] + x * sin + z * cos,
  ]);

  pushBox(geometry, backrestCorners[0] as Vec3, backrestTop[2] as Vec3);

  // 다리 (4개)
  const legPositions = [
    [-seatHalfLength + 0.08, -seatHalfWidth + 0.08],
    [-seatHalfLength + 0.08, seatHalfWidth - 0.08],
    [seatHalfLength - 0.08, -seatHalfWidth + 0.08],
    [seatHalfLength - 0.08, seatHalfWidth - 0.08],
  ];

  for (const [lx, lz] of legPositions) {
    const transformedX = center[0] + lx * cos - lz * sin;
    const transformedZ = center[2] + lx * sin + lz * cos;
    pushBox(
      geometry,
      [transformedX - 0.04, center[1], transformedZ - 0.04],
      [transformedX + 0.04, center[1] + legHeight, transformedZ + 0.04],
    );
  }

  // variant 1, 2: 팔걸이 추가
  if (variant >= 1) {
    const armrestHeight = seatHeight + 0.25;
    const armrestPositions = [
      [-seatHalfLength + 0.15, 0],
      [seatHalfLength - 0.15, 0],
    ];

    for (const [ax, az] of armrestPositions) {
      const transformedX = center[0] + ax * cos - az * sin;
      const transformedZ = center[2] + ax * sin + az * cos;
      pushBox(
        geometry,
        [transformedX - 0.04, center[1] + seatHeight, transformedZ - 0.04],
        [transformedX + 0.04, center[1] + armrestHeight, transformedZ + 0.04],
      );
    }
  }
}

function pushBikeRackAssembly(
  geometry: GeometryBuffers,
  center: Vec3,
  variant: number,
): void {
  if (variant === 0) {
    // U자형 거치대 (inverted U)
    const rackWidth = 1.2;
    const rackHeight = 0.95;
    const pipeRadius = 0.04;

    // 수직 파이프 2개
    pushBox(
      geometry,
      [
        center[0] - rackWidth / 2 - pipeRadius,
        center[1],
        center[2] - pipeRadius,
      ],
      [
        center[0] - rackWidth / 2 + pipeRadius,
        center[1] + rackHeight,
        center[2] + pipeRadius,
      ],
    );
    pushBox(
      geometry,
      [
        center[0] + rackWidth / 2 - pipeRadius,
        center[1],
        center[2] - pipeRadius,
      ],
      [
        center[0] + rackWidth / 2 + pipeRadius,
        center[1] + rackHeight,
        center[2] + pipeRadius,
      ],
    );

    // 상단 가로 파이프
    pushBox(
      geometry,
      [
        center[0] - rackWidth / 2 - pipeRadius,
        center[1] + rackHeight - pipeRadius,
        center[2] - pipeRadius,
      ],
      [
        center[0] + rackWidth / 2 + pipeRadius,
        center[1] + rackHeight + pipeRadius,
        center[2] + pipeRadius,
      ],
    );

    // 베이스 플레이트
    pushBox(
      geometry,
      [center[0] - rackWidth / 2 - 0.08, center[1], center[2] - 0.12],
      [center[0] - rackWidth / 2 + 0.08, center[1] + 0.04, center[2] + 0.12],
    );
    pushBox(
      geometry,
      [center[0] + rackWidth / 2 - 0.08, center[1], center[2] - 0.12],
      [center[0] + rackWidth / 2 + 0.08, center[1] + 0.04, center[2] + 0.12],
    );
  } else {
    // 그리드형 거치대 (multiple inverted U)
    const gridSpacing = 0.6;
    const gridCount = 3;
    const rackHeight = 0.85;
    const pipeRadius = 0.035;

    for (let i = 0; i < gridCount; i++) {
      const offsetX = (i - (gridCount - 1) / 2) * gridSpacing;

      // 수직 파이프
      pushBox(
        geometry,
        [center[0] + offsetX - pipeRadius, center[1], center[2] - pipeRadius],
        [
          center[0] + offsetX + pipeRadius,
          center[1] + rackHeight,
          center[2] + pipeRadius,
        ],
      );

      // 상단 가로 연결 (i가 마지막이 아닐 때)
      if (i < gridCount - 1) {
        pushBox(
          geometry,
          [
            center[0] + offsetX + pipeRadius,
            center[1] + rackHeight - pipeRadius,
            center[2] - pipeRadius,
          ],
          [
            center[0] + offsetX + gridSpacing - pipeRadius,
            center[1] + rackHeight + pipeRadius,
            center[2] + pipeRadius,
          ],
        );
      }
    }

    // 베이스 레일
    pushBox(
      geometry,
      [center[0] - (gridCount * gridSpacing) / 2, center[1], center[2] - 0.06],
      [
        center[0] + (gridCount * gridSpacing) / 2,
        center[1] + 0.03,
        center[2] + 0.06,
      ],
    );
  }
}

function pushTrashCanAssembly(
  geometry: GeometryBuffers,
  center: Vec3,
  variant: number,
): void {
  const canRadius = variant === 0 ? 0.28 : 0.35;
  const canHeight = variant === 0 ? 0.95 : 1.1;
  const lidHeight = 0.08;
  const baseHeight = 0.06;

  // 베이스
  pushCylinder(geometry, center, canRadius + 0.02, baseHeight, 8);

  // 본체 (원통형)
  pushCylinder(
    geometry,
    [center[0], center[1] + baseHeight, center[2]],
    canRadius,
    canHeight - baseHeight,
    12,
  );

  // 상단 림
  pushCylinder(
    geometry,
    [center[0], center[1] + canHeight - 0.02, center[2]],
    canRadius + 0.015,
    0.04,
    12,
  );

  // 뚜껑
  if (variant === 1) {
    // 반원형 뚜껑 (투입구 있는 형)
    pushCylinder(
      geometry,
      [center[0], center[1] + canHeight, center[2]],
      canRadius + 0.03,
      lidHeight,
      12,
    );
    // 뚜껑 손잡이
    pushBox(
      geometry,
      [center[0] - 0.08, center[1] + canHeight + lidHeight, center[2] - 0.02],
      [
        center[0] + 0.08,
        center[1] + canHeight + lidHeight + 0.06,
        center[2] + 0.02,
      ],
    );
  } else {
    // 평평한 뚜껑
    pushCylinder(
      geometry,
      [center[0], center[1] + canHeight, center[2]],
      canRadius + 0.02,
      lidHeight,
      12,
    );
  }
}

function pushFireHydrantAssembly(
  geometry: GeometryBuffers,
  center: Vec3,
): void {
  const bodyHeight = 0.75;
  const bodyRadius = 0.12;
  const capHeight = 0.12;
  const nozzleRadius = 0.05;

  // 베이스
  pushCylinder(geometry, center, bodyRadius + 0.03, 0.08, 8);

  // 본체
  pushCylinder(
    geometry,
    [center[0], center[1] + 0.08, center[2]],
    bodyRadius,
    bodyHeight - 0.08,
    8,
  );

  // 상단 캡
  pushCylinder(
    geometry,
    [center[0], center[1] + bodyHeight, center[2]],
    bodyRadius + 0.02,
    capHeight,
    8,
  );

  // 상단 돌출부 (밸브)
  pushBox(
    geometry,
    [center[0] - 0.06, center[1] + bodyHeight + capHeight, center[2] - 0.06],
    [
      center[0] + 0.06,
      center[1] + bodyHeight + capHeight + 0.15,
      center[2] + 0.06,
    ],
  );

  // 사이드 노즐 (2개)
  const nozzleHeight = bodyHeight * 0.55;
  const nozzleLength = 0.18;

  // 앞쪽 노즐
  pushCylinder(
    geometry,
    [
      center[0],
      center[1] + nozzleHeight,
      center[2] + bodyRadius + nozzleLength / 2,
    ],
    nozzleRadius,
    nozzleLength,
    6,
    'horizontal',
  );

  // 뒤쪽 노즐
  pushCylinder(
    geometry,
    [
      center[0],
      center[1] + nozzleHeight,
      center[2] - bodyRadius - nozzleLength / 2,
    ],
    nozzleRadius,
    nozzleLength,
    6,
    'horizontal',
  );

  // 노즐 캡
  pushCylinder(
    geometry,
    [
      center[0],
      center[1] + nozzleHeight,
      center[2] + bodyRadius + nozzleLength + 0.02,
    ],
    nozzleRadius + 0.015,
    0.04,
    6,
  );
  pushCylinder(
    geometry,
    [
      center[0],
      center[1] + nozzleHeight,
      center[2] - bodyRadius - nozzleLength - 0.02,
    ],
    nozzleRadius + 0.015,
    0.04,
    6,
  );
}

function pushEnhancedStreetLightAssembly(
  geometry: GeometryBuffers,
  center: Vec3,
  variant: number,
): void {
  switch (variant) {
    case 0:
      pushModernStreetLight(geometry, center);
      break;
    case 1:
      pushClassicStreetLight(geometry, center);
      break;
    case 2:
      pushPostTopStreetLight(geometry, center);
      break;
    case 3:
      pushDoubleArmStreetLight(geometry, center);
      break;
    default:
      pushModernStreetLight(geometry, center);
  }
}

function pushModernStreetLight(geometry: GeometryBuffers, center: Vec3): void {
  const poleHeight = 8.5;
  const armLength = 1.5;

  // 기둥 (테이퍼형)
  pushTaperedCylinder(geometry, center, 0.12, 0.08, poleHeight, 8);

  // 베이스
  pushBox(
    geometry,
    [center[0] - 0.22, center[1], center[2] - 0.22],
    [center[0] + 0.22, center[1] + 0.15, center[2] + 0.22],
  );

  // 암 (수평)
  pushBox(
    geometry,
    [center[0], center[1] + poleHeight - 0.25, center[2] - 0.04],
    [center[0] + armLength, center[1] + poleHeight - 0.08, center[2] + 0.04],
  );

  // 램프 헤드
  const headX = center[0] + armLength;
  pushBox(
    geometry,
    [headX - 0.22, center[1] + poleHeight - 0.35, center[2] - 0.18],
    [headX + 0.12, center[1] + poleHeight + 0.02, center[2] + 0.18],
  );

  // 램프 글로브 (아래로 돌출)
  pushBox(
    geometry,
    [headX - 0.15, center[1] + poleHeight - 0.55, center[2] - 0.12],
    [headX + 0.05, center[1] + poleHeight - 0.35, center[2] + 0.12],
  );
}

function pushClassicStreetLight(geometry: GeometryBuffers, center: Vec3): void {
  const poleHeight = 5.5;
  const armLength = 0.9;

  // 기둥 (장식형)
  pushCylinder(geometry, [center[0], center[1], center[2]], 0.1, poleHeight, 8);

  // 장식 베이스
  pushBox(
    geometry,
    [center[0] - 0.25, center[1], center[2] - 0.25],
    [center[0] + 0.25, center[1] + 0.35, center[2] + 0.25],
  );

  // 장식 링 (중간)
  pushCylinder(
    geometry,
    [center[0], center[1] + poleHeight * 0.3, center[2]],
    0.13,
    0.08,
    8,
  );

  // 굽은 암 (S자형)
  const armStartHeight = poleHeight - 0.4;
  pushBox(
    geometry,
    [center[0] - 0.06, center[1] + armStartHeight - 0.15, center[2] - 0.06],
    [center[0] + 0.06, center[1] + armStartHeight + 0.15, center[2] + 0.06],
  );
  pushBox(
    geometry,
    [center[0], center[1] + armStartHeight - 0.04, center[2]],
    [
      center[0] + armLength,
      center[1] + armStartHeight + 0.08,
      center[2] + 0.08,
    ],
  );

  // 램프 글로브 (구형)
  const headX = center[0] + armLength;
  pushCylinder(
    geometry,
    [headX, center[1] + armStartHeight - 0.12, center[2]],
    0.18,
    0.24,
    12,
  );
}

function pushPostTopStreetLight(geometry: GeometryBuffers, center: Vec3): void {
  const poleHeight = 4.2;

  // 기둥
  pushCylinder(
    geometry,
    [center[0], center[1], center[2]],
    0.08,
    poleHeight,
    8,
  );

  // 베이스
  pushBox(
    geometry,
    [center[0] - 0.18, center[1], center[2] - 0.18],
    [center[0] + 0.18, center[1] + 0.12, center[2] + 0.18],
  );

  // 상단 램프 하우징
  pushBox(
    geometry,
    [center[0] - 0.28, center[1] + poleHeight, center[2] - 0.28],
    [center[0] + 0.28, center[1] + poleHeight + 0.35, center[2] + 0.28],
  );

  // 글로브 (반구형)
  pushCylinder(
    geometry,
    [center[0], center[1] + poleHeight + 0.35, center[2]],
    0.25,
    0.22,
    12,
  );

  // 상단 캡
  pushCylinder(
    geometry,
    [center[0], center[1] + poleHeight + 0.57, center[2]],
    0.12,
    0.08,
    8,
  );
}

function pushDoubleArmStreetLight(
  geometry: GeometryBuffers,
  center: Vec3,
): void {
  const poleHeight = 9.2;
  const armLength = 1.4;

  // 기둥 (테이퍼형)
  pushTaperedCylinder(geometry, center, 0.14, 0.09, poleHeight, 8);

  // 베이스
  pushBox(
    geometry,
    [center[0] - 0.26, center[1], center[2] - 0.26],
    [center[0] + 0.26, center[1] + 0.18, center[2] + 0.26],
  );

  // 양쪽 암
  for (const direction of [-1, 1]) {
    const armOffset = direction * armLength;

    // 암
    pushBox(
      geometry,
      [center[0] - 0.05, center[1] + poleHeight - 0.22, center[2]],
      [
        center[0] + armOffset + 0.05,
        center[1] + poleHeight - 0.06,
        center[2] + 0.06 * direction,
      ],
    );

    // 램프 헤드
    const headX = center[0] + armOffset;
    pushBox(
      geometry,
      [
        headX - 0.18,
        center[1] + poleHeight - 0.32,
        center[2] - 0.15 * direction - 0.15,
      ],
      [
        headX + 0.1,
        center[1] + poleHeight + 0.02,
        center[2] - 0.15 * direction + 0.15,
      ],
    );
  }

  // 중간 장식 링
  pushCylinder(
    geometry,
    [center[0], center[1] + poleHeight * 0.6, center[2]],
    0.11,
    0.06,
    8,
  );
}

function pushEnhancedSignPoleAssembly(
  geometry: GeometryBuffers,
  center: Vec3,
  variant: number,
): void {
  const poleHeight = 3.2 + variant * 0.25;

  // 기둥
  pushCylinder(
    geometry,
    [center[0], center[1], center[2]],
    0.065,
    poleHeight,
    8,
  );

  // 베이스
  pushBox(
    geometry,
    [center[0] - 0.16, center[1], center[2] - 0.16],
    [center[0] + 0.16, center[1] + 0.08, center[2] + 0.16],
  );

  // 메인 패널
  const panelHeight = poleHeight - 0.35;
  const panelWidth = 0.55 + variant * 0.08;
  const panelHeightSize = 0.65 + variant * 0.05;

  pushBox(
    geometry,
    [
      center[0] - panelWidth / 2,
      center[1] + panelHeight - panelHeightSize,
      center[2] - 0.03,
    ],
    [center[0] + panelWidth / 2, center[1] + panelHeight, center[2] + 0.03],
  );

  // 패널 프레임 (테두리)
  pushBox(
    geometry,
    [
      center[0] - panelWidth / 2 - 0.015,
      center[1] + panelHeight - panelHeightSize - 0.015,
      center[2] - 0.04,
    ],
    [
      center[0] + panelWidth / 2 + 0.015,
      center[1] + panelHeight + 0.015,
      center[2] - 0.02,
    ],
  );
  pushBox(
    geometry,
    [
      center[0] - panelWidth / 2 - 0.015,
      center[1] + panelHeight - panelHeightSize - 0.015,
      center[2] + 0.02,
    ],
    [
      center[0] + panelWidth / 2 + 0.015,
      center[1] + panelHeight + 0.015,
      center[2] + 0.04,
    ],
  );

  // 보조 패널 (variant 1, 2, 3)
  if (variant >= 1) {
    const subPanelHeight = panelHeight - panelHeightSize - 0.25;
    const subPanelWidth = 0.35 + variant * 0.05;
    const subPanelHeightSize = 0.35;

    pushBox(
      geometry,
      [
        center[0] - subPanelWidth / 2,
        center[1] + subPanelHeight - subPanelHeightSize,
        center[2] - 0.025,
      ],
      [
        center[0] + subPanelWidth / 2,
        center[1] + subPanelHeight,
        center[2] + 0.025,
      ],
    );
  }

  // 화살표 패널 (variant 2, 3)
  if (variant >= 2) {
    const arrowPanelHeight = panelHeight + 0.12;
    const arrowWidth = 0.25;

    // 화살표 형태의 상단 패널
    pushBox(
      geometry,
      [center[0] - arrowWidth, center[1] + arrowPanelHeight, center[2] - 0.02],
      [
        center[0] + arrowWidth,
        center[1] + arrowPanelHeight + 0.18,
        center[2] + 0.02,
      ],
    );
    // 화살표 머리
    pushBox(
      geometry,
      [
        center[0] - arrowWidth * 1.5,
        center[1] + arrowPanelHeight + 0.18,
        center[2] - 0.02,
      ],
      [center[0], center[1] + arrowPanelHeight + 0.35, center[2] + 0.02],
    );
  }

  // 방향 표시판 (variant 3)
  if (variant >= 3) {
    const directionPanelHeight = panelHeight - panelHeightSize - 0.55;
    const directionWidth = 0.85;

    pushBox(
      geometry,
      [
        center[0] - directionWidth / 2,
        center[1] + directionPanelHeight - 0.22,
        center[2] - 0.02,
      ],
      [
        center[0] + directionWidth / 2,
        center[1] + directionPanelHeight,
        center[2] + 0.02,
      ],
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function pushBox(geometry: GeometryBuffers, min: Vec3, max: Vec3): void {
  const baseIndex = geometry.positions.length / 3;

  // 8개의 꼭짓점
  const vertices: Vec3[] = [
    [min[0], min[1], min[2]], // 0
    [max[0], min[1], min[2]], // 1
    [max[0], max[1], min[2]], // 2
    [min[0], max[1], min[2]], // 3
    [min[0], min[1], max[2]], // 4
    [max[0], min[1], max[2]], // 5
    [max[0], max[1], max[2]], // 6
    [min[0], max[1], max[2]], // 7
  ];

  // 정점 추가
  for (const v of vertices) {
    geometry.positions.push(...v);
  }

  // 면 법선 계산
  const faceNormals: Array<{ normal: Vec3; indices: number[] }> = [
    { normal: [0, 0, -1], indices: [0, 1, 2, 3] }, // 앞
    { normal: [0, 0, 1], indices: [4, 7, 6, 5] }, // 뒤
    { normal: [0, -1, 0], indices: [0, 4, 5, 1] }, // 아래
    { normal: [0, 1, 0], indices: [2, 6, 7, 3] }, // 위
    { normal: [-1, 0, 0], indices: [0, 3, 7, 4] }, // 왼쪽
    { normal: [1, 0, 0], indices: [1, 5, 6, 2] }, // 오른쪽
  ];

  // 법선 추가
  for (let i = 0; i < 8; i++) {
    const normal = faceNormals.find((f) => f.indices.includes(i))?.normal ?? [
      0, 1, 0,
    ];
    geometry.normals.push(...normal);
  }

  // 인덱스 추가 (6개 면, 각 2개 삼각형)
  geometry.indices.push(
    baseIndex + 0,
    baseIndex + 1,
    baseIndex + 2,
    baseIndex + 0,
    baseIndex + 2,
    baseIndex + 3,
  );
  geometry.indices.push(
    baseIndex + 4,
    baseIndex + 7,
    baseIndex + 6,
    baseIndex + 4,
    baseIndex + 6,
    baseIndex + 5,
  );
  geometry.indices.push(
    baseIndex + 0,
    baseIndex + 4,
    baseIndex + 5,
    baseIndex + 0,
    baseIndex + 5,
    baseIndex + 1,
  );
  geometry.indices.push(
    baseIndex + 2,
    baseIndex + 6,
    baseIndex + 7,
    baseIndex + 2,
    baseIndex + 7,
    baseIndex + 3,
  );
  geometry.indices.push(
    baseIndex + 0,
    baseIndex + 3,
    baseIndex + 7,
    baseIndex + 0,
    baseIndex + 7,
    baseIndex + 4,
  );
  geometry.indices.push(
    baseIndex + 1,
    baseIndex + 5,
    baseIndex + 6,
    baseIndex + 1,
    baseIndex + 6,
    baseIndex + 2,
  );
}

function pushCylinder(
  geometry: GeometryBuffers,
  center: Vec3,
  radius: number,
  height: number,
  segments: number,
  orientation: 'vertical' | 'horizontal' = 'vertical',
): void {
  const baseIndex = geometry.positions.length / 3;
  const angleStep = (2 * Math.PI) / segments;

  // 상단 및 하단 중심점
  const topY = orientation === 'vertical' ? center[1] + height : center[1];
  const bottomY =
    orientation === 'vertical' ? center[1] : center[1] - height / 2;

  // 원통의 정점들
  for (let i = 0; i <= segments; i++) {
    const angle = i * angleStep;
    const x = center[0] + radius * Math.cos(angle);
    const z = center[2] + radius * Math.sin(angle);

    if (orientation === 'vertical') {
      geometry.positions.push(x, bottomY, z);
      geometry.positions.push(x, topY, z);

      // 법선 (방사형)
      geometry.normals.push(Math.cos(angle), 0, Math.sin(angle));
      geometry.normals.push(Math.cos(angle), 0, Math.sin(angle));
    } else {
      // 수평 원통
      geometry.positions.push(x, bottomY, z);
      geometry.positions.push(x, topY, z);

      geometry.normals.push(Math.cos(angle), 0, Math.sin(angle));
      geometry.normals.push(Math.cos(angle), 0, Math.sin(angle));
    }
  }

  // 측면 인덱스
  for (let i = 0; i < segments; i++) {
    const current = baseIndex + i * 2;
    const next = baseIndex + (i + 1) * 2;

    geometry.indices.push(current, next, next + 1);
    geometry.indices.push(current, next + 1, current + 1);
  }
}

function pushTaperedCylinder(
  geometry: GeometryBuffers,
  center: Vec3,
  bottomRadius: number,
  topRadius: number,
  height: number,
  segments: number,
): void {
  const baseIndex = geometry.positions.length / 3;
  const angleStep = (2 * Math.PI) / segments;

  for (let i = 0; i <= segments; i++) {
    const angle = i * angleStep;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const bottomX = center[0] + bottomRadius * cos;
    const bottomZ = center[2] + bottomRadius * sin;
    const topX = center[0] + topRadius * cos;
    const topZ = center[2] + topRadius * sin;

    geometry.positions.push(bottomX, center[1], bottomZ);
    geometry.positions.push(topX, center[1] + height, topZ);

    // 법선 (테이퍼 고려)
    const normalY = (bottomRadius - topRadius) / height;
    const normalLen = Math.sqrt(cos * cos + normalY * normalY + sin * sin);
    geometry.normals.push(
      cos / normalLen,
      normalY / normalLen,
      sin / normalLen,
    );
    geometry.normals.push(
      cos / normalLen,
      normalY / normalLen,
      sin / normalLen,
    );
  }

  for (let i = 0; i < segments; i++) {
    const current = baseIndex + i * 2;
    const next = baseIndex + (i + 1) * 2;

    geometry.indices.push(current, next, next + 1);
    geometry.indices.push(current, next + 1, current + 1);
  }
}

function toLocalPoint(origin: Coordinate, point: Coordinate): Vec3 {
  const metersPerLat = 111_320;
  const metersPerLng = 111_320 * Math.cos((origin.lat * Math.PI) / 180);

  return [
    (point.lng - origin.lng) * metersPerLng,
    0,
    -(point.lat - origin.lat) * metersPerLat,
  ];
}

function isFiniteVec3(vector: Vec3): boolean {
  return (
    Number.isFinite(vector[0]) &&
    Number.isFinite(vector[1]) &&
    Number.isFinite(vector[2])
  );
}

function stableVariant(seed: string, modulo: number): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
}
