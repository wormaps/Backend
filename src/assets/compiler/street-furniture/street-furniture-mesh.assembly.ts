import type { GeometryBuffers, Vec3 } from '../road/road-mesh.builder';
import {
  pushBox,
  pushCylinder,
  pushTaperedCylinder,
} from './street-furniture-mesh.geometry.utils';
import type { SceneVariationProfile } from '../scene-variation';

export function pushBenchAssembly(
  geometry: GeometryBuffers,
  center: Vec3,
  variant: number,
  variationProfile: SceneVariationProfile,
): void {
  const benchLength =
    1.8 * (0.96 + (variationProfile.furnitureDetailBoost - 1) * 0.25);
  const benchWidth =
    0.55 * (0.98 + (variationProfile.furnitureDetailBoost - 1) * 0.2);
  const seatHeight = 0.45;
  const backrestHeight = 0.85;
  const legHeight = 0.42;
  const rotation = (variant * Math.PI) / 2;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const seatHalfLength = benchLength / 2;
  const seatHalfWidth = benchWidth / 2;

  const corners: Vec3[] = [
    [-seatHalfLength, -seatHalfWidth],
    [seatHalfLength, -seatHalfWidth],
    [seatHalfLength, seatHalfWidth],
    [-seatHalfLength, seatHalfWidth],
  ].map(([x, z]) => [
    center[0] + (x ?? 0) * cos - (z ?? 0) * sin,
    center[1] + seatHeight,
    center[2] + (x ?? 0) * sin + (z ?? 0) * cos,
  ] as Vec3);

  const c0 = corners[0];
  const c2 = corners[2];
  if (c0 && c2) {
    pushBox(geometry, c0, c2);
  }

  const backrestThickness = 0.06;
  const backrestY = seatHeight + (backrestHeight - seatHeight) / 2;
  const backrestCorners: Vec3[] = [
    [-seatHalfLength, -seatHalfWidth - backrestThickness],
    [seatHalfLength, -seatHalfWidth - backrestThickness],
    [seatHalfLength, -seatHalfWidth],
    [-seatHalfLength, -seatHalfWidth],
  ].map(([x, z]) => [
    center[0] + (x ?? 0) * cos - (z ?? 0) * sin,
    center[1] + backrestY,
    center[2] + (x ?? 0) * sin + (z ?? 0) * cos,
  ] as Vec3);
  const backrestTop: Vec3[] = [
    [-seatHalfLength, -seatHalfWidth - backrestThickness],
    [seatHalfLength, -seatHalfWidth - backrestThickness],
    [seatHalfLength, -seatHalfWidth],
    [-seatHalfLength, -seatHalfWidth],
  ].map(([x, z]) => [
    center[0] + (x ?? 0) * cos - (z ?? 0) * sin,
    center[1] + backrestHeight,
    center[2] + (x ?? 0) * sin + (z ?? 0) * cos,
  ] as Vec3);

  const bc0 = backrestCorners[0];
  const bt2 = backrestTop[2];
  if (bc0 && bt2) {
    pushBox(geometry, bc0, bt2);
  }

  const legPositions: Array<[number, number]> = [
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

  if (variant >= 1) {
    const armrestHeight = seatHeight + 0.25;
    const armrestPositions: Array<[number, number]> = [
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

export function pushBikeRackAssembly(
  geometry: GeometryBuffers,
  center: Vec3,
  variant: number,
  variationProfile: SceneVariationProfile,
): void {
  const detailScale = 0.98 + (variationProfile.furnitureDetailBoost - 1) * 0.28;
  if (variant === 0) {
    const rackWidth = 1.2;
    const rackHeight = 0.95;
    const pipeRadius = 0.04;

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
    const gridSpacing = 0.6 * detailScale;
    const gridCount = 3;
    const rackHeight = 0.85;
    const pipeRadius = 0.035;

    for (let i = 0; i < gridCount; i += 1) {
      const offsetX = (i - (gridCount - 1) / 2) * gridSpacing;

      pushBox(
        geometry,
        [center[0] + offsetX - pipeRadius, center[1], center[2] - pipeRadius],
        [
          center[0] + offsetX + pipeRadius,
          center[1] + rackHeight,
          center[2] + pipeRadius,
        ],
      );

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

export function pushTrashCanAssembly(
  geometry: GeometryBuffers,
  center: Vec3,
  variant: number,
  variationProfile: SceneVariationProfile,
): void {
  const detailScale = 0.98 + (variationProfile.furnitureDetailBoost - 1) * 0.24;
  const canRadius = (variant === 0 ? 0.28 : 0.35) * detailScale;
  const canHeight = variant === 0 ? 0.95 : 1.1;
  const lidHeight = 0.08;
  const baseHeight = 0.06;

  pushCylinder(geometry, center, canRadius + 0.02, baseHeight, 8);
  pushCylinder(
    geometry,
    [center[0], center[1] + baseHeight, center[2]],
    canRadius,
    canHeight - baseHeight,
    12,
  );
  pushCylinder(
    geometry,
    [center[0], center[1] + canHeight - 0.02, center[2]],
    canRadius + 0.015,
    0.04,
    12,
  );

  if (variant === 1) {
    pushCylinder(
      geometry,
      [center[0], center[1] + canHeight, center[2]],
      canRadius + 0.03,
      lidHeight,
      12,
    );
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
    pushCylinder(
      geometry,
      [center[0], center[1] + canHeight, center[2]],
      canRadius + 0.02,
      lidHeight,
      12,
    );
  }
}

export function pushFireHydrantAssembly(
  geometry: GeometryBuffers,
  center: Vec3,
  variationProfile: SceneVariationProfile,
): void {
  const detailScale = 0.98 + (variationProfile.furnitureDetailBoost - 1) * 0.2;
  const bodyHeight = 0.75;
  const bodyRadius = 0.12 * detailScale;
  const capHeight = 0.12;
  const nozzleRadius = 0.05;

  pushCylinder(geometry, center, bodyRadius + 0.03, 0.08, 8);
  pushCylinder(
    geometry,
    [center[0], center[1] + 0.08, center[2]],
    bodyRadius,
    bodyHeight - 0.08,
    8,
  );
  pushCylinder(
    geometry,
    [center[0], center[1] + bodyHeight, center[2]],
    bodyRadius + 0.02,
    capHeight,
    8,
  );
  pushBox(
    geometry,
    [center[0] - 0.06, center[1] + bodyHeight + capHeight, center[2] - 0.06],
    [
      center[0] + 0.06,
      center[1] + bodyHeight + capHeight + 0.15,
      center[2] + 0.06,
    ],
  );

  const nozzleHeight = bodyHeight * 0.55;
  const nozzleLength = 0.18;

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

export function pushEnhancedStreetLightAssembly(
  geometry: GeometryBuffers,
  center: Vec3,
  variant: number,
  variationProfile: SceneVariationProfile,
): void {
  switch (variant) {
    case 0:
      pushModernStreetLight(geometry, center, variationProfile);
      break;
    case 1:
      pushClassicStreetLight(geometry, center, variationProfile);
      break;
    case 2:
      pushPostTopStreetLight(geometry, center, variationProfile);
      break;
    case 3:
      pushDoubleArmStreetLight(geometry, center, variationProfile);
      break;
    default:
      pushModernStreetLight(geometry, center, variationProfile);
  }
}

function pushModernStreetLight(
  geometry: GeometryBuffers,
  center: Vec3,
  variationProfile: SceneVariationProfile,
): void {
  const poleHeight =
    8.5 * (0.98 + (variationProfile.furnitureDetailBoost - 1) * 0.2);
  const armLength = 1.7;

  pushTaperedCylinder(geometry, center, 0.12, 0.08, poleHeight, 8);
  pushBox(
    geometry,
    [center[0] - 0.22, center[1], center[2] - 0.22],
    [center[0] + 0.22, center[1] + 0.15, center[2] + 0.22],
  );
  pushBox(
    geometry,
    [center[0], center[1] + poleHeight - 0.25, center[2] - 0.04],
    [center[0] + armLength, center[1] + poleHeight - 0.08, center[2] + 0.04],
  );

  const headX = center[0] + armLength;
  pushBox(
    geometry,
    [headX - 0.22, center[1] + poleHeight - 0.35, center[2] - 0.18],
    [headX + 0.12, center[1] + poleHeight + 0.02, center[2] + 0.18],
  );
  pushBox(
    geometry,
    [headX - 0.15, center[1] + poleHeight - 0.55, center[2] - 0.12],
    [headX + 0.05, center[1] + poleHeight - 0.35, center[2] + 0.12],
  );
}

function pushClassicStreetLight(
  geometry: GeometryBuffers,
  center: Vec3,
  variationProfile: SceneVariationProfile,
): void {
  const poleHeight =
    5.5 * (0.98 + (variationProfile.furnitureDetailBoost - 1) * 0.2);
  const armLength = 1.05;

  pushCylinder(geometry, [center[0], center[1], center[2]], 0.1, poleHeight, 8);
  pushBox(
    geometry,
    [center[0] - 0.25, center[1], center[2] - 0.25],
    [center[0] + 0.25, center[1] + 0.35, center[2] + 0.25],
  );
  pushCylinder(
    geometry,
    [center[0], center[1] + poleHeight * 0.3, center[2]],
    0.13,
    0.08,
    8,
  );

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

  const headX = center[0] + armLength;
  pushCylinder(
    geometry,
    [headX, center[1] + armStartHeight - 0.12, center[2]],
    0.18,
    0.24,
    12,
  );
}

function pushPostTopStreetLight(
  geometry: GeometryBuffers,
  center: Vec3,
  variationProfile: SceneVariationProfile,
): void {
  const poleHeight =
    4.2 * (0.98 + (variationProfile.furnitureDetailBoost - 1) * 0.18);
  pushCylinder(
    geometry,
    [center[0], center[1], center[2]],
    0.08,
    poleHeight,
    8,
  );
  pushBox(
    geometry,
    [center[0] - 0.18, center[1], center[2] - 0.18],
    [center[0] + 0.18, center[1] + 0.12, center[2] + 0.18],
  );
  pushBox(
    geometry,
    [center[0] - 0.28, center[1] + poleHeight, center[2] - 0.28],
    [center[0] + 0.28, center[1] + poleHeight + 0.35, center[2] + 0.28],
  );
  pushCylinder(
    geometry,
    [center[0], center[1] + poleHeight + 0.35, center[2]],
    0.25,
    0.22,
    12,
  );
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
  variationProfile: SceneVariationProfile,
): void {
  const poleHeight =
    9.2 * (0.98 + (variationProfile.furnitureDetailBoost - 1) * 0.22);
  const armLength = 1.65;

  pushTaperedCylinder(geometry, center, 0.14, 0.09, poleHeight, 8);
  pushBox(
    geometry,
    [center[0] - 0.26, center[1], center[2] - 0.26],
    [center[0] + 0.26, center[1] + 0.18, center[2] + 0.26],
  );

  for (const direction of [-1, 1]) {
    const armOffset = direction * armLength;
    pushBox(
      geometry,
      [center[0] - 0.05, center[1] + poleHeight - 0.22, center[2]],
      [
        center[0] + armOffset + 0.05,
        center[1] + poleHeight - 0.06,
        center[2] + 0.06 * direction,
      ],
    );

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

  pushCylinder(
    geometry,
    [center[0], center[1] + poleHeight * 0.6, center[2]],
    0.11,
    0.06,
    8,
  );
}

export function pushEnhancedSignPoleAssembly(
  geometry: GeometryBuffers,
  center: Vec3,
  variant: number,
  variationProfile: SceneVariationProfile,
): void {
  const poleHeight =
    (3.2 + variant * 0.25) *
    (0.98 + (variationProfile.furnitureDetailBoost - 1) * 0.18);

  pushCylinder(
    geometry,
    [center[0], center[1], center[2]],
    0.065,
    poleHeight,
    8,
  );
  pushBox(
    geometry,
    [center[0] - 0.16, center[1], center[2] - 0.16],
    [center[0] + 0.16, center[1] + 0.08, center[2] + 0.16],
  );

  const panelHeight = poleHeight - 0.35;
  const panelWidth = 0.62 + variant * 0.09;
  const panelHeightSize = 0.72 + variant * 0.06;

  pushBox(
    geometry,
    [
      center[0] - panelWidth / 2,
      center[1] + panelHeight - panelHeightSize,
      center[2] - 0.03,
    ],
    [center[0] + panelWidth / 2, center[1] + panelHeight, center[2] + 0.03],
  );

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

  if (variant >= 2) {
    const arrowPanelHeight = panelHeight + 0.12;
    const arrowWidth = 0.32;

    pushBox(
      geometry,
      [center[0] - arrowWidth, center[1] + arrowPanelHeight, center[2] - 0.02],
      [
        center[0] + arrowWidth,
        center[1] + arrowPanelHeight + 0.18,
        center[2] + 0.02,
      ],
    );
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

  if (variant >= 3) {
    const directionPanelHeight = panelHeight - panelHeightSize - 0.55;
    const directionWidth = 1.05;

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

export function pushPostBoxAssembly(
  geometry: GeometryBuffers,
  center: Vec3,
  _variant: number,
  _variationProfile: SceneVariationProfile,
): void {
  const baseY = 0.9;
  const boxWidth = 0.35;
  const boxDepth = 0.25;
  const boxHeight = 0.45;

  pushCylinder(
    geometry,
    [center[0], baseY / 2, center[2]],
    0.04,
    baseY,
    6,
  );

  pushBox(
    geometry,
    [center[0] - boxWidth / 2, baseY, center[2] - boxDepth / 2],
    [center[0] + boxWidth / 2, baseY + boxHeight, center[2] + boxDepth / 2],
  );
}

export function pushPublicPhoneAssembly(
  geometry: GeometryBuffers,
  center: Vec3,
  _variant: number,
  _variationProfile: SceneVariationProfile,
): void {
  const kioskWidth = 0.8;
  const kioskDepth = 0.5;
  const kioskHeight = 2.2;

  pushBox(
    geometry,
    [center[0] - kioskWidth / 2, 0, center[2] - kioskDepth / 2],
    [center[0] + kioskWidth / 2, kioskHeight, center[2] + kioskDepth / 2],
  );
}

export function pushAdvertisingAssembly(
  geometry: GeometryBuffers,
  center: Vec3,
  variant: number,
  _variationProfile: SceneVariationProfile,
): void {
  const poleHeight = 2.5 + (variant % 3) * 0.3;
  const panelWidth = 1.2 + (variant % 2) * 0.4;
  const panelHeight = 0.8 + (variant % 2) * 0.2;
  const panelDepth = 0.04;

  pushCylinder(
    geometry,
    [center[0], poleHeight / 2, center[2]],
    0.05,
    poleHeight,
    6,
  );

  pushBox(
    geometry,
    [center[0] - panelWidth / 2, poleHeight, center[2] - panelDepth / 2],
    [center[0] + panelWidth / 2, poleHeight + panelHeight, center[2] + panelDepth / 2],
  );
}

export function pushVendingMachineAssembly(
  geometry: GeometryBuffers,
  center: Vec3,
  _variant: number,
  _variationProfile: SceneVariationProfile,
): void {
  const machineWidth = 0.6;
  const machineDepth = 0.4;
  const machineHeight = 1.6;

  pushBox(
    geometry,
    [center[0] - machineWidth / 2, 0, center[2] - machineDepth / 2],
    [center[0] + machineWidth / 2, machineHeight, center[2] + machineDepth / 2],
  );
}
