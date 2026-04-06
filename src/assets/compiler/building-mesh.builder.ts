import type { Coordinate } from '../../places/types/place.types';
import type {
  GeometryStrategy,
  SceneFacadeHint,
  SceneMeta,
  SceneSignageCluster,
  WindowPatternDensity,
} from '../../scene/types/scene.types';
import type { AccentTone } from './glb-material-factory';
import type { GeometryBuffers, Vec3 } from './road-mesh.builder';
import { createEmptyGeometry } from './road-mesh.builder';
import {
  averagePoint,
  computeBounds,
  hexToRgb,
  isFiniteVec3,
  isPolygonTooThin,
  normalizeLocalRing,
  samePointXZ,
  toLocalPoint,
  toLocalRing,
} from './building-mesh-utils';

export function createBuildingShellGeometry(
  origin: Coordinate,
  buildings: SceneMeta['buildings'],
  triangulate: (
    vertices: number[],
    holes?: number[],
    dimensions?: number,
  ) => number[],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const building of buildings) {
    const outerRing = normalizeLocalRing(
      toLocalRing(origin, building.outerRing),
      'CCW',
    );
    const holes = building.holes
      .map((ring) => normalizeLocalRing(toLocalRing(origin, ring), 'CW'))
      .filter((ring) => ring.length >= 3);
    if (outerRing.length < 3) {
      continue;
    }

    pushBuildingByStrategy(geometry, building, outerRing, holes, triangulate);
  }

  return geometry;
}

export function createBuildingPanelsGeometry(
  origin: Coordinate,
  buildings: SceneMeta['buildings'],
  facadeHints: SceneFacadeHint[],
  tone: AccentTone,
): GeometryBuffers {
  const geometry = createEmptyGeometry();
  const hintMap = new Map(facadeHints.map((hint) => [hint.objectId, hint]));

  for (const building of buildings) {
    const hint = hintMap.get(building.objectId);
    if (
      !hint ||
      resolveAccentTone(hint.panelPalette ?? hint.palette) !== tone
    ) {
      continue;
    }

    const outerRing = normalizeLocalRing(
      toLocalRing(origin, building.outerRing),
      'CCW',
    );
    const edgeIndex =
      hint.facadeEdgeIndex !== null &&
      hint.facadeEdgeIndex >= 0 &&
      hint.facadeEdgeIndex < outerRing.length
        ? hint.facadeEdgeIndex
        : resolveLongestEdgeIndex(outerRing);
    const frame = buildFacadeFrame(
      outerRing,
      edgeIndex,
      Math.max(6, building.heightMeters * 0.9),
    );
    if (!frame) {
      continue;
    }

    pushFacadePresetPanels(geometry, frame, hint, building.heightMeters);
  }

  return geometry;
}

export function createBuildingRoofSurfaceGeometry(
  origin: Coordinate,
  buildings: SceneMeta['buildings'],
  triangulate: (
    vertices: number[],
    holes?: number[],
    dimensions?: number,
  ) => number[],
  tone: AccentTone,
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const building of buildings) {
    if (resolveRoofTone(building) !== tone) {
      continue;
    }
    const outerRing = normalizeLocalRing(
      toLocalRing(origin, building.outerRing),
      'CCW',
    );
    if (outerRing.length < 3) {
      continue;
    }
    const roofRing = insetRing(
      outerRing,
      building.roofType === 'gable' ? 0.08 : 0.05,
    );
    if (roofRing.length < 3) {
      continue;
    }
    const topHeight = Math.max(4, building.heightMeters);
    const slabMin = topHeight + 0.02;
    const slabMax = topHeight + (building.roofType === 'gable' ? 0.18 : 0.12);
    pushExtrudedPolygon(geometry, roofRing, [], slabMin, slabMax, triangulate);
  }

  return geometry;
}

export function createHeroCanopyGeometry(
  origin: Coordinate,
  buildings: SceneMeta['buildings'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const building of buildings) {
    if (!building.visualRole || building.visualRole === 'generic') {
      continue;
    }
    const ring = normalizeLocalRing(
      toLocalRing(origin, building.outerRing),
      'CCW',
    );
    if (ring.length < 3) {
      continue;
    }
    const canopyEdges = building.podiumSpec?.canopyEdges ?? [];
    for (const edgeIndex of canopyEdges) {
      const frame = buildFacadeFrame(
        ring,
        edgeIndex % ring.length,
        Math.max(
          4.2,
          building.podiumSpec?.levels ? building.podiumSpec.levels * 3.6 : 4.2,
        ),
      );
      if (!frame) {
        continue;
      }
      pushCanopyBand(geometry, frame, 4.2);
    }
  }

  return geometry;
}

export function createHeroRoofUnitGeometry(
  origin: Coordinate,
  buildings: SceneMeta['buildings'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const building of buildings) {
    const roofUnits = building.roofSpec?.roofUnits ?? 0;
    if (
      !building.visualRole ||
      building.visualRole === 'generic' ||
      roofUnits <= 0
    ) {
      continue;
    }
    const ring = normalizeLocalRing(
      toLocalRing(origin, building.outerRing),
      'CCW',
    );
    if (ring.length < 3) {
      continue;
    }
    const inset = insetRing(ring, 0.18);
    const bounds = computeBounds(inset.length >= 3 ? inset : ring);
    const columns = Math.max(1, Math.ceil(Math.sqrt(roofUnits)));
    for (let index = 0; index < roofUnits; index += 1) {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const centerX = bounds.minX + ((col + 1) / (columns + 1)) * bounds.width;
      const centerZ =
        bounds.minZ +
        ((row + 1) / (Math.ceil(roofUnits / columns) + 1)) * bounds.depth;
      pushBox(
        geometry,
        [centerX - 0.7, building.heightMeters + 0.2, centerZ - 0.5],
        [centerX + 0.7, building.heightMeters + 1.6, centerZ + 0.5],
      );
    }
  }

  return geometry;
}

export function createHeroBillboardPlaneGeometry(
  origin: Coordinate,
  buildings: SceneMeta['buildings'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const building of buildings) {
    const faces = building.signageSpec?.billboardFaces ?? [];
    if (
      !building.visualRole ||
      building.visualRole === 'generic' ||
      faces.length === 0
    ) {
      continue;
    }
    const ring = normalizeLocalRing(
      toLocalRing(origin, building.outerRing),
      'CCW',
    );
    if (ring.length < 3) {
      continue;
    }
    for (const edgeIndex of faces) {
      const frame = buildFacadeFrame(
        ring,
        edgeIndex % ring.length,
        Math.max(8, building.heightMeters * 0.78),
      );
      if (!frame) {
        continue;
      }
      pushTopBillboardZone(geometry, frame);
    }
  }

  return geometry;
}

export function createBillboardsGeometry(
  origin: Coordinate,
  clusters: SceneSignageCluster[],
  tone: AccentTone,
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const cluster of clusters) {
    if (resolveAccentTone(cluster.palette) !== tone) {
      continue;
    }
    const anchor = toLocalPoint(origin, cluster.anchor);
    const poleWidth = 0.08;
    pushBox(
      geometry,
      [anchor[0] - poleWidth, 0, anchor[2] - poleWidth],
      [anchor[0] + poleWidth, 4.6, anchor[2] + poleWidth],
    );
    pushQuad(
      geometry,
      [anchor[0] - cluster.widthMeters / 2, 4.6, anchor[2] + 0.24],
      [anchor[0] + cluster.widthMeters / 2, 4.6, anchor[2] + 0.24],
      [
        anchor[0] + cluster.widthMeters / 2,
        4.6 + cluster.heightMeters,
        anchor[2] + 0.24,
      ],
      [
        anchor[0] - cluster.widthMeters / 2,
        4.6 + cluster.heightMeters,
        anchor[2] + 0.24,
      ],
    );
  }

  return geometry;
}

export function createLandmarkExtrasGeometry(
  origin: Coordinate,
  anchors: SceneMeta['landmarkAnchors'],
  clusters: SceneSignageCluster[],
): GeometryBuffers {
  const geometry = createEmptyGeometry();
  for (const anchor of anchors.slice(0, 8)) {
    const center = toLocalPoint(origin, anchor.location);
    const size = anchor.kind === 'CROSSING' ? 1.2 : 0.8;
    pushBox(
      geometry,
      [center[0] - size, 0.02, center[2] - size],
      [center[0] + size, 0.18, center[2] + size],
    );
  }

  for (const cluster of clusters.slice(0, 6)) {
    const anchor = toLocalPoint(origin, cluster.anchor);
    pushBox(
      geometry,
      [anchor[0] - 0.2, 6.2, anchor[2] - 0.2],
      [anchor[0] + 0.2, 7.2, anchor[2] + 0.2],
    );
  }

  return geometry;
}

export function resolveAccentTone(palette: string[]): AccentTone {
  const sample = palette.find(Boolean);
  if (!sample) {
    return 'neutral';
  }

  const [r, g, b] = hexToRgb(sample);
  if (Math.abs(r - b) <= 0.08 && Math.abs(r - g) <= 0.08) {
    return 'neutral';
  }
  if (r >= b + 0.06) {
    return 'warm';
  }
  if (b >= r + 0.06) {
    return 'cool';
  }
  return g > 0.5 ? 'cool' : 'neutral';
}

function resolveRoofTone(building: SceneMeta['buildings'][number]): AccentTone {
  const explicit = building.roofColor ?? building.facadeColor;
  if (explicit) {
    return resolveAccentTone([explicit]);
  }
  if (building.roofType === 'gable') {
    return 'warm';
  }
  return building.preset === 'glass_tower' ? 'cool' : 'neutral';
}

function pushBuildingByStrategy(
  geometry: GeometryBuffers,
  building: SceneMeta['buildings'][number],
  outerRing: Vec3[],
  holes: Vec3[][],
  triangulate: (
    vertices: number[],
    holes?: number[],
    dimensions?: number,
  ) => number[],
): void {
  if (building.visualRole && building.visualRole !== 'generic') {
    pushHeroBuilding(geometry, building, outerRing, holes, triangulate);
    return;
  }

  const strategy = resolveBuildingGeometryStrategy(building, holes, outerRing);
  const height = Math.max(4, building.heightMeters);

  switch (strategy) {
    case 'podium_tower': {
      const podiumHeight = Math.min(
        height * 0.52,
        Math.max(6, (building.podiumLevels ?? 2) * 4),
      );
      pushExtrudedPolygon(
        geometry,
        outerRing,
        holes,
        0,
        podiumHeight,
        triangulate,
      );
      const insetRatio = building.cornerChamfer ? 0.2 : 0.14;
      const towerRing = insetRing(outerRing, insetRatio);
      if (towerRing.length >= 3) {
        const towerTop = Math.max(podiumHeight + 4, height);
        pushExtrudedPolygon(
          geometry,
          towerRing,
          [],
          podiumHeight,
          towerTop,
          triangulate,
        );
      }
      break;
    }
    case 'stepped_tower': {
      const baseTop = Math.max(8, height * 0.58);
      pushExtrudedPolygon(geometry, outerRing, holes, 0, baseTop, triangulate);
      let currentRing = outerRing;
      const stageCount = Math.max(2, Math.min(3, building.setbackLevels ?? 2));
      for (let stage = 0; stage < stageCount; stage += 1) {
        currentRing = insetRing(currentRing, 0.12 + stage * 0.04);
        if (currentRing.length < 3) {
          break;
        }
        const stageMin = baseTop + stage * ((height - baseTop) / stageCount);
        const stageMax =
          stage === stageCount - 1
            ? height
            : baseTop + (stage + 1) * ((height - baseTop) / stageCount);
        pushExtrudedPolygon(
          geometry,
          currentRing,
          [],
          stageMin,
          stageMax,
          triangulate,
        );
      }
      break;
    }
    case 'gable_lowrise': {
      const roofBaseHeight = Math.max(3.2, height * 0.72);
      pushExtrudedPolygon(
        geometry,
        outerRing,
        holes,
        0,
        roofBaseHeight,
        triangulate,
      );
      pushGableRoof(geometry, outerRing, roofBaseHeight, height);
      break;
    }
    case 'courtyard_block': {
      pushExtrudedPolygon(geometry, outerRing, holes, 0, height, triangulate);
      break;
    }
    case 'fallback_massing': {
      const bounds = computeBounds(outerRing);
      pushBox(
        geometry,
        [bounds.minX, 0, bounds.minZ],
        [bounds.maxX, height, bounds.maxZ],
      );
      break;
    }
    case 'simple_extrude':
    default: {
      pushExtrudedPolygon(geometry, outerRing, holes, 0, height, triangulate);
      break;
    }
  }
}

function pushHeroBuilding(
  geometry: GeometryBuffers,
  building: SceneMeta['buildings'][number],
  outerRing: Vec3[],
  holes: Vec3[][],
  triangulate: (
    vertices: number[],
    holes?: number[],
    dimensions?: number,
  ) => number[],
): void {
  const height = Math.max(6, building.heightMeters);
  const baseMass = building.baseMass ?? 'podium_tower';
  const podiumLevels =
    building.podiumSpec?.levels ?? building.podiumLevels ?? 2;
  const setbacks = building.podiumSpec?.setbacks ?? building.setbackLevels ?? 1;
  const podiumHeight = Math.min(
    height * 0.45,
    Math.max(5.5, podiumLevels * 3.8),
  );

  if (baseMass === 'lowrise_strip') {
    pushExtrudedPolygon(geometry, outerRing, holes, 0, height, triangulate);
    return;
  }

  if (baseMass === 'simple') {
    pushExtrudedPolygon(geometry, outerRing, holes, 0, height, triangulate);
    return;
  }

  pushExtrudedPolygon(geometry, outerRing, holes, 0, podiumHeight, triangulate);

  let currentRing = outerRing;
  const stageCount =
    baseMass === 'stepped_tower' || baseMass === 'corner_tower'
      ? Math.max(2, setbacks || 2)
      : 1;
  for (let stage = 0; stage < stageCount; stage += 1) {
    const insetRatio =
      baseMass === 'corner_tower'
        ? 0.18 + stage * 0.05
        : baseMass === 'slab_midrise'
          ? 0.08 + stage * 0.03
          : 0.12 + stage * 0.04;
    currentRing = insetRing(currentRing, insetRatio);
    if (currentRing.length < 3) {
      break;
    }
    const stageMin =
      stage === 0
        ? podiumHeight
        : podiumHeight + stage * ((height - podiumHeight) / stageCount);
    const stageMax =
      stage === stageCount - 1
        ? height
        : podiumHeight + (stage + 1) * ((height - podiumHeight) / stageCount);
    pushExtrudedPolygon(
      geometry,
      currentRing,
      [],
      stageMin,
      stageMax,
      triangulate,
    );
  }
}

function pushExtrudedPolygon(
  geometry: GeometryBuffers,
  outerRing: Vec3[],
  holes: Vec3[][],
  minHeight: number,
  maxHeight: number,
  triangulate: (
    vertices: number[],
    holes?: number[],
    dimensions?: number,
  ) => number[],
): void {
  const triangulated = triangulateRings(outerRing, holes, triangulate);
  if (triangulated.length === 0) {
    return;
  }

  for (const [a, b, c] of triangulated) {
    pushTriangle(
      geometry,
      [a[0], maxHeight, a[2]],
      [b[0], maxHeight, b[2]],
      [c[0], maxHeight, c[2]],
    );
    pushTriangle(
      geometry,
      [a[0], minHeight, a[2]],
      [c[0], minHeight, c[2]],
      [b[0], minHeight, b[2]],
    );
  }

  pushRingWallsBetween(geometry, outerRing, minHeight, maxHeight, false);
  for (const hole of holes) {
    pushRingWallsBetween(geometry, hole, minHeight, maxHeight, true);
  }
}

function resolveBuildingGeometryStrategy(
  building: SceneMeta['buildings'][number],
  holes: Vec3[][],
  outerRing: Vec3[],
): GeometryStrategy {
  if ((building.geometryStrategy ?? 'simple_extrude') === 'fallback_massing') {
    return 'fallback_massing';
  }
  if (holes.length > 0) {
    return 'courtyard_block';
  }
  if (isPolygonTooThin(outerRing)) {
    return 'fallback_massing';
  }
  return building.geometryStrategy ?? 'simple_extrude';
}

function pushFacadePresetPanels(
  geometry: GeometryBuffers,
  frame: FacadeFrame,
  hint: SceneFacadeHint,
  buildingHeight: number,
): void {
  const preset = hint.facadePreset ?? 'concrete_repetitive';
  const repeatY = hint.facadeSpec?.windowRepeatY ?? hint.windowBands;
  const repeatX = hint.facadeSpec?.windowRepeatX ?? undefined;
  const bandCount = Math.max(1, repeatY);
  const signBandLevels = Math.max(
    0,
    hint.signageSpec?.signBandLevels ?? hint.signBandLevels ?? 0,
  );
  const glazing = hint.glazingRatio;
  const facadeDepth = resolveFacadeBackingDepth(hint);

  pushFacadeBacking(geometry, frame, facadeDepth, hint);

  if (hint.facadeSpec) {
    const lowerHeight = Math.min(
      frame.height * 0.3,
      Math.max(4.5, buildingHeight * 0.16),
    );
    const topHeight = Math.min(
      frame.height * 0.22,
      Math.max(3.2, buildingHeight * 0.12),
    );
    const lowerFrame = splitFacadeFrame(frame, 0, lowerHeight);
    const midFrame = splitFacadeFrame(
      frame,
      lowerHeight,
      Math.max(lowerHeight + 1.8, frame.height - topHeight),
    );
    const topFrame = splitFacadeFrame(
      frame,
      Math.max(lowerHeight + 1.8, frame.height - topHeight),
      frame.height,
    );

    pushFacadeBandByType(
      geometry,
      lowerFrame,
      hint.facadeSpec.lowerBandType,
      Math.max(1, Math.min(2, signBandLevels || 1)),
      glazing,
      repeatX,
      Math.max(2, Math.floor(bandCount * 0.22)),
    );
    pushFacadeBandByType(
      geometry,
      midFrame,
      hint.facadeSpec.midBandType,
      Math.max(1, signBandLevels),
      glazing,
      repeatX,
      Math.max(3, Math.floor(bandCount * 0.56)),
    );
    pushFacadeBandByType(
      geometry,
      topFrame,
      hint.facadeSpec.topBandType,
      Math.max(1, Math.min(2, signBandLevels || 1)),
      glazing,
      repeatX,
      Math.max(2, Math.floor(bandCount * 0.22)),
    );

    if (hint.visualRole && hint.visualRole !== 'generic') {
      const canopyEdges = hint.podiumSpec?.canopyEdges.length ?? 0;
      if (
        canopyEdges > 0 ||
        hint.facadeSpec.lowerBandType === 'retail_sign_band'
      ) {
        pushCanopyBand(
          geometry,
          lowerFrame,
          Math.max(4, buildingHeight * 0.12),
        );
      }
    }

    return;
  }

  switch (preset) {
    case 'glass_grid':
      pushHorizontalBands(geometry, frame, bandCount, 0.42, 0.55);
      pushVerticalMullions(
        geometry,
        frame,
        hint.windowPatternDensity ?? 'dense',
        glazing,
        repeatX,
      );
      break;
    case 'retail_sign_band':
      pushSignBands(geometry, frame, signBandLevels || 2, 1.15);
      pushHorizontalBands(
        geometry,
        frame,
        Math.max(2, bandCount - 1),
        0.24,
        0.58,
      );
      break;
    case 'mall_panel':
      pushSignBands(geometry, frame, signBandLevels || 3, 1.4);
      pushHorizontalBands(
        geometry,
        frame,
        Math.max(2, Math.floor(bandCount / 2)),
        0.8,
        0.68,
      );
      if (hint.billboardEligible) {
        pushTopBillboardZone(geometry, frame);
      }
      break;
    case 'brick_lowrise':
      pushHorizontalBands(geometry, frame, Math.min(3, bandCount), 0.18, 0.44);
      if (signBandLevels > 0) {
        pushSignBands(geometry, frame, 1, 0.95);
      }
      break;
    case 'station_metal':
      pushHorizontalBands(
        geometry,
        frame,
        Math.max(2, Math.floor(bandCount / 2)),
        0.72,
        0.62,
      );
      pushCanopyBand(geometry, frame, Math.max(3, buildingHeight * 0.16));
      break;
    case 'concrete_repetitive':
    default:
      pushHorizontalBands(geometry, frame, bandCount, 0.28, 0.5);
      break;
  }

  if (hint.billboardEligible && preset !== 'mall_panel') {
    pushTopBillboardZone(geometry, frame);
  }

  if ((hint.signageSpec?.screenFaces.length ?? 0) > 0) {
    pushTopBillboardZone(geometry, frame);
  }

  if (hint.visualRole && hint.visualRole !== 'generic') {
    const canopyEdges = hint.podiumSpec?.canopyEdges.length ?? 0;
    if (canopyEdges > 0 || preset === 'retail_sign_band') {
      pushCanopyBand(geometry, frame, Math.max(4, buildingHeight * 0.12));
    }
  }
}

function pushFacadeBandByType(
  geometry: GeometryBuffers,
  frame: SplitFacadeFrame,
  bandType: NonNullable<SceneFacadeHint['facadeSpec']>['lowerBandType'],
  signBandLevels: number,
  glazing: number,
  repeatX: number | undefined,
  bandCount: number,
): void {
  switch (bandType) {
    case 'clear':
      return;
    case 'retail_sign_band':
      pushSignBands(geometry, frame, Math.max(1, signBandLevels), 1.15);
      pushHorizontalBands(geometry, frame, Math.max(2, bandCount), 0.22, 0.98);
      return;
    case 'screen_band':
      pushSolidPanel(geometry, frame, 0.1);
      pushTopBillboardZone(geometry, frame);
      return;
    case 'window_grid':
      pushHorizontalBands(geometry, frame, Math.max(2, bandCount), 0.4, 0.98);
      pushVerticalMullions(geometry, frame, 'dense', glazing, repeatX);
      return;
    case 'solid_panel':
      pushHorizontalBands(
        geometry,
        frame,
        Math.max(1, Math.floor(bandCount / 2)),
        0.82,
        0.98,
      );
      return;
    default:
      return;
  }
}

function pushHorizontalBands(
  geometry: GeometryBuffers,
  frame: PartialFacadeFrame,
  bandCount: number,
  bandFill: number,
  topCapRatio: number,
): void {
  const yMin = getFrameYMin(frame);
  const yMax = getFrameYMax(frame);
  const availableHeight = Math.max(0.4, yMax - yMin);
  const margin = Math.min(0.6, availableHeight * 0.12);
  const step = Math.max(
    0.8,
    (availableHeight - margin * 2) / Math.max(1, bandCount),
  );
  for (let band = 0; band < bandCount; band += 1) {
    const y0 = Math.min(yMax - 0.2, yMin + margin + band * step);
    const y1 = Math.min(
      yMin + availableHeight * topCapRatio,
      y0 + Math.min(step * bandFill, 1.05),
    );
    if (y1 <= y0 + 0.08) {
      continue;
    }
    pushFacadeSlab(geometry, frame, y0, y1, 0.08);
  }
}

function pushVerticalMullions(
  geometry: GeometryBuffers,
  frame: PartialFacadeFrame,
  density: WindowPatternDensity,
  glazingRatio: number,
  overrideCount?: number,
): void {
  const yMin = getFrameYMin(frame) + 0.25;
  const yMax = getFrameYMax(frame) - 0.25;
  if (yMax <= yMin + 0.3) {
    return;
  }
  const mullionCount =
    overrideCount ?? (density === 'dense' ? 7 : density === 'medium' ? 5 : 3);
  for (let index = 1; index < mullionCount; index += 1) {
    const t = index / mullionCount;
    const x0 = frame.a[0] + (frame.b[0] - frame.a[0]) * t;
    const z0 = frame.a[2] + (frame.b[2] - frame.a[2]) * t;
    const width = Math.max(0.06, 0.14 - glazingRatio * 0.06);
    pushVerticalMullionVolume(
      geometry,
      frame,
      [x0, 0, z0],
      yMin,
      yMax,
      width,
      0.1,
    );
  }
}

function pushSignBands(
  geometry: GeometryBuffers,
  frame: PartialFacadeFrame,
  levels: number,
  bandHeight: number,
): void {
  const yMin = getFrameYMin(frame);
  const yMax = getFrameYMax(frame);
  for (let level = 0; level < levels; level += 1) {
    const y0 = yMin + 0.35 + level * (bandHeight + 0.2);
    const y1 = Math.min(yMax - 0.12, y0 + bandHeight);
    if (y1 <= y0 + 0.08) {
      continue;
    }
    pushFacadeSlab(geometry, frame, y0, y1, 0.14);
  }
}

function pushTopBillboardZone(
  geometry: GeometryBuffers,
  frame: PartialFacadeFrame,
): void {
  const yMin = getFrameYMin(frame);
  const yMax = getFrameYMax(frame);
  const topStart = Math.max(yMin + (yMax - yMin) * 0.18, yMax - 2.8);
  const topEnd = Math.min(
    yMax - 0.08,
    topStart + Math.min(2.8, yMax - yMin - 0.12),
  );
  if (topEnd <= topStart + 0.08) {
    return;
  }
  pushFacadeSlab(geometry, frame, topStart, topEnd, 0.16);
}

function pushCanopyBand(
  geometry: GeometryBuffers,
  frame: PartialFacadeFrame,
  canopyHeight: number,
): void {
  const yMin = getFrameYMin(frame);
  const yMax = getFrameYMax(frame);
  const y0 = Math.min(yMax - 0.35, Math.max(yMin + 0.2, yMin + 4));
  const y1 = Math.min(yMax - 0.05, y0 + Math.max(1.2, canopyHeight * 0.18));
  if (y1 <= y0 + 0.08) {
    return;
  }
  pushFacadeSlab(geometry, frame, y0, y1, 0.18);
}

function pushSolidPanel(
  geometry: GeometryBuffers,
  frame: PartialFacadeFrame,
  insetY: number,
): void {
  const yMin = getFrameYMin(frame) + insetY;
  const yMax = getFrameYMax(frame) - insetY;
  if (yMax <= yMin + 0.08) {
    return;
  }
  pushFacadeSlab(geometry, frame, yMin, yMax, 0.1);
}

function splitFacadeFrame(
  frame: FacadeFrame,
  yMin: number,
  yMax: number,
): SplitFacadeFrame {
  return {
    ...frame,
    yMin: Math.max(0, yMin),
    yMax: Math.max(yMin, Math.min(frame.height, yMax)),
  };
}

function triangulateRings(
  outerRing: Vec3[],
  holes: Vec3[][],
  triangulate: (
    vertices: number[],
    holes?: number[],
    dimensions?: number,
  ) => number[],
): Array<[Vec3, Vec3, Vec3]> {
  const vertices: number[] = [];
  const points: Vec3[] = [];
  const holeIndices: number[] = [];

  const pushRing = (ring: Vec3[]) => {
    for (const point of ring) {
      points.push(point);
      vertices.push(point[0], point[2]);
    }
  };

  pushRing(outerRing);
  for (const hole of holes) {
    holeIndices.push(points.length);
    pushRing(hole);
  }

  const indices = triangulate(vertices, holeIndices, 2);
  const triangles: Array<[Vec3, Vec3, Vec3]> = [];
  for (let index = 0; index < indices.length; index += 3) {
    const a = points[indices[index]];
    const b = points[indices[index + 1]];
    const c = points[indices[index + 2]];
    if (!a || !b || !c) {
      continue;
    }
    if (samePointXZ(a, b) || samePointXZ(b, c) || samePointXZ(a, c)) {
      continue;
    }
    triangles.push([a, b, c]);
  }

  return triangles;
}

function pushRingWallsBetween(
  geometry: GeometryBuffers,
  ring: Vec3[],
  minHeight: number,
  maxHeight: number,
  invert: boolean,
): void {
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    if (invert) {
      pushQuad(
        geometry,
        [next[0], minHeight, next[2]],
        [current[0], minHeight, current[2]],
        [current[0], maxHeight, current[2]],
        [next[0], maxHeight, next[2]],
      );
    } else {
      pushQuad(
        geometry,
        [current[0], minHeight, current[2]],
        [next[0], minHeight, next[2]],
        [next[0], maxHeight, next[2]],
        [current[0], maxHeight, current[2]],
      );
    }
  }
}

function pushGableRoof(
  geometry: GeometryBuffers,
  outerRing: Vec3[],
  roofBaseHeight: number,
  topHeight: number,
): void {
  const bounds = computeBounds(outerRing);
  const ridgeAlongX = bounds.width >= bounds.depth;
  const ridgeHeight = Math.max(topHeight, roofBaseHeight + 1.1);
  const ridgeA: Vec3 = ridgeAlongX
    ? [bounds.minX, ridgeHeight, (bounds.minZ + bounds.maxZ) / 2]
    : [(bounds.minX + bounds.maxX) / 2, ridgeHeight, bounds.minZ];
  const ridgeB: Vec3 = ridgeAlongX
    ? [bounds.maxX, ridgeHeight, (bounds.minZ + bounds.maxZ) / 2]
    : [(bounds.minX + bounds.maxX) / 2, ridgeHeight, bounds.maxZ];

  for (let index = 0; index < outerRing.length; index += 1) {
    const current = outerRing[index];
    const next = outerRing[(index + 1) % outerRing.length];
    const currentRidge = ridgeAlongX
      ? ([current[0], ridgeHeight, ridgeA[2]] as Vec3)
      : ([ridgeA[0], ridgeHeight, current[2]] as Vec3);
    const nextRidge = ridgeAlongX
      ? ([next[0], ridgeHeight, ridgeA[2]] as Vec3)
      : ([ridgeA[0], ridgeHeight, next[2]] as Vec3);
    pushQuad(
      geometry,
      [current[0], roofBaseHeight, current[2]],
      [next[0], roofBaseHeight, next[2]],
      nextRidge,
      currentRidge,
    );
  }

  pushTriangle(
    geometry,
    [bounds.minX, roofBaseHeight, bounds.minZ],
    [bounds.minX, roofBaseHeight, bounds.maxZ],
    ridgeA,
  );
  pushTriangle(
    geometry,
    [bounds.maxX, roofBaseHeight, bounds.maxZ],
    [bounds.maxX, roofBaseHeight, bounds.minZ],
    ridgeB,
  );
}

function insetRing(points: Vec3[], ratio: number): Vec3[] {
  const center = averagePoint(points);
  return points.map((point) => [
    center[0] + (point[0] - center[0]) * (1 - ratio),
    0,
    center[2] + (point[2] - center[2]) * (1 - ratio),
  ]);
}

function resolveLongestEdgeIndex(points: Vec3[]): number {
  let longestIndex = 0;
  let longestLength = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const length = Math.hypot(next[0] - current[0], next[2] - current[2]);
    if (length > longestLength) {
      longestLength = length;
      longestIndex = index;
    }
  }
  return longestIndex;
}

function buildFacadeFrame(
  ring: Vec3[],
  edgeIndex: number,
  facadeHeight: number,
): FacadeFrame | null {
  const current = ring[edgeIndex];
  const next = ring[(edgeIndex + 1) % ring.length];
  if (!current || !next) {
    return null;
  }
  const centroid = averagePoint(ring);
  const edge = [next[0] - current[0], 0, next[2] - current[2]] as Vec3;
  const edgeLength = Math.hypot(edge[0], edge[2]);
  if (edgeLength <= 0.4) {
    return null;
  }
  let normal: Vec3 = [-edge[2] / edgeLength, 0, edge[0] / edgeLength];
  const midpoint: Vec3 = [
    (current[0] + next[0]) / 2,
    0,
    (current[2] + next[2]) / 2,
  ];
  const toCentroid: Vec3 = [
    centroid[0] - midpoint[0],
    0,
    centroid[2] - midpoint[2],
  ];
  if (normal[0] * toCentroid[0] + normal[2] * toCentroid[2] > 0) {
    normal = [-normal[0], 0, -normal[2]];
  }
  const offset = 0.18;
  return {
    a: [current[0] + normal[0] * offset, 0, current[2] + normal[2] * offset],
    b: [next[0] + normal[0] * offset, 0, next[2] + normal[2] * offset],
    height: facadeHeight,
    normal,
  };
}

function pushFacadeBacking(
  geometry: GeometryBuffers,
  frame: FacadeFrame,
  depth: number,
  hint: SceneFacadeHint,
): void {
  const insetTop = hint.facadePreset === 'glass_grid' ? 0.35 : 0.2;
  const yMin = 0.22;
  const yMax = Math.max(yMin + 0.8, frame.height - insetTop);
  pushFacadeSlab(geometry, frame, yMin, yMax, depth);
}

function pushFacadeSlab(
  geometry: GeometryBuffers,
  frame: PartialFacadeFrame,
  yMin: number,
  yMax: number,
  depth: number,
): void {
  if (yMax <= yMin + 0.08) {
    return;
  }
  const frontA: Vec3 = [frame.a[0], yMin, frame.a[2]];
  const frontB: Vec3 = [frame.b[0], yMin, frame.b[2]];
  const frontC: Vec3 = [frame.b[0], yMax, frame.b[2]];
  const frontD: Vec3 = [frame.a[0], yMax, frame.a[2]];
  const backA: Vec3 = [
    frame.a[0] - frame.normal[0] * depth,
    yMin,
    frame.a[2] - frame.normal[2] * depth,
  ];
  const backB: Vec3 = [
    frame.b[0] - frame.normal[0] * depth,
    yMin,
    frame.b[2] - frame.normal[2] * depth,
  ];
  const backC: Vec3 = [
    frame.b[0] - frame.normal[0] * depth,
    yMax,
    frame.b[2] - frame.normal[2] * depth,
  ];
  const backD: Vec3 = [
    frame.a[0] - frame.normal[0] * depth,
    yMax,
    frame.a[2] - frame.normal[2] * depth,
  ];

  pushQuad(geometry, frontA, frontB, frontC, frontD);
  pushQuad(geometry, backB, backA, backD, backC);
  pushQuad(geometry, backA, frontA, frontD, backD);
  pushQuad(geometry, frontB, backB, backC, frontC);
  pushQuad(geometry, frontD, frontC, backC, backD);
  pushQuad(geometry, backA, backB, frontB, frontA);
}

function pushVerticalMullionVolume(
  geometry: GeometryBuffers,
  frame: PartialFacadeFrame,
  center: Vec3,
  yMin: number,
  yMax: number,
  width: number,
  depth: number,
): void {
  const edgeDx = frame.b[0] - frame.a[0];
  const edgeDz = frame.b[2] - frame.a[2];
  const edgeLength = Math.hypot(edgeDx, edgeDz);
  if (edgeLength <= 1e-6) {
    return;
  }
  const tangent: Vec3 = [edgeDx / edgeLength, 0, edgeDz / edgeLength];
  const halfWidth = width / 2;
  const left = [
    center[0] - tangent[0] * halfWidth,
    0,
    center[2] - tangent[2] * halfWidth,
  ] as Vec3;
  const right = [
    center[0] + tangent[0] * halfWidth,
    0,
    center[2] + tangent[2] * halfWidth,
  ] as Vec3;
  pushFacadeSlab(
    geometry,
    {
      ...frame,
      a: left,
      b: right,
    },
    yMin,
    yMax,
    depth,
  );
}

function resolveFacadeBackingDepth(hint: SceneFacadeHint): number {
  if (hint.facadePreset === 'glass_grid') {
    return 0.1;
  }
  if (hint.signageDensity === 'high') {
    return 0.14;
  }

  return 0.12;
}

function getFrameYMin(frame: PartialFacadeFrame): number {
  return 'yMin' in frame ? frame.yMin : 0;
}

function getFrameYMax(frame: PartialFacadeFrame): number {
  return 'yMax' in frame ? frame.yMax : frame.height;
}

interface FacadeFrame {
  a: Vec3;
  b: Vec3;
  height: number;
  normal: Vec3;
}

interface SplitFacadeFrame extends FacadeFrame {
  yMin: number;
  yMax: number;
}

type PartialFacadeFrame = FacadeFrame | SplitFacadeFrame;

function pushBox(geometry: GeometryBuffers, min: Vec3, max: Vec3): void {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  pushQuad(geometry, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  pushQuad(geometry, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
  pushQuad(geometry, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
  pushQuad(geometry, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
  pushQuad(geometry, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
  pushQuad(geometry, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
}

function pushQuad(
  geometry: GeometryBuffers,
  a: Vec3,
  b: Vec3,
  c: Vec3,
  d: Vec3,
): void {
  pushTriangle(geometry, a, b, c);
  pushTriangle(geometry, a, c, d);
}

function pushTriangle(
  geometry: GeometryBuffers,
  a: Vec3,
  b: Vec3,
  c: Vec3,
): void {
  const normal = computeNormal(a, b, c);
  if (normal === null) {
    return;
  }
  const baseIndex = geometry.positions.length / 3;
  geometry.positions.push(...a, ...b, ...c);
  geometry.normals.push(...normal, ...normal, ...normal);
  geometry.indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
}

function computeNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 | null {
  if (![a, b, c].every((point) => isFiniteVec3(point))) {
    return null;
  }

  const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cross: Vec3 = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  const length = Math.hypot(cross[0], cross[1], cross[2]);
  if (!Number.isFinite(length) || length <= 1e-6) {
    return null;
  }

  return [cross[0] / length, cross[1] / length, cross[2] / length];
}

export function createBuildingWindowGeometry(
  origin: Coordinate,
  buildings: SceneMeta['buildings'],
  facadeHints: SceneFacadeHint[],
): GeometryBuffers {
  const geometry = createEmptyGeometry();
  const hintMap = new Map(facadeHints.map((hint) => [hint.objectId, hint]));

  for (const building of buildings) {
    const hint = hintMap.get(building.objectId);
    if (!hint) {
      continue;
    }

    const outerRing = normalizeLocalRing(
      toLocalRing(origin, building.outerRing),
      'CCW',
    );
    if (outerRing.length < 3) {
      continue;
    }

    const windowConfig = resolveWindowConfig(building, hint);
    const height = Math.max(4, building.heightMeters);

    for (let edgeIndex = 0; edgeIndex < outerRing.length; edgeIndex += 1) {
      const frame = buildFacadeFrame(outerRing, edgeIndex, height);
      if (!frame) {
        continue;
      }

      pushWindowGrid(geometry, frame, windowConfig, height);
    }
  }

  return geometry;
}

export function createBuildingEntranceGeometry(
  origin: Coordinate,
  buildings: SceneMeta['buildings'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const building of buildings) {
    const outerRing = normalizeLocalRing(
      toLocalRing(origin, building.outerRing),
      'CCW',
    );
    if (outerRing.length < 3) {
      continue;
    }

    const entranceConfig = resolveEntranceConfig(building);
    const height = Math.max(4, building.heightMeters);

    const mainEdgeIndex = resolveLongestEdgeIndex(outerRing);
    const frame = buildFacadeFrame(outerRing, mainEdgeIndex, height);
    if (!frame) {
      continue;
    }

    pushEntranceAssembly(geometry, frame, entranceConfig, height);
  }

  return geometry;
}

export function createBuildingRoofEquipmentGeometry(
  origin: Coordinate,
  buildings: SceneMeta['buildings'],
): GeometryBuffers {
  const geometry = createEmptyGeometry();

  for (const building of buildings) {
    const outerRing = normalizeLocalRing(
      toLocalRing(origin, building.outerRing),
      'CCW',
    );
    if (outerRing.length < 3) {
      continue;
    }

    const equipmentConfig = resolveRoofEquipmentConfig(building);
    if (equipmentConfig.unitCount === 0) {
      continue;
    }

    const inset = insetRing(outerRing, 0.15);
    const bounds = computeBounds(inset.length >= 3 ? inset : outerRing);
    const topHeight = Math.max(4, building.heightMeters);

    pushRoofEquipmentAssembly(geometry, bounds, topHeight, equipmentConfig);
  }

  return geometry;
}

interface WindowConfig {
  floorCount: number;
  windowsPerFloor: number;
  windowWidth: number;
  windowHeight: number;
  windowDepth: number;
  frameWidth: number;
  sillDepth: number;
  pattern: 'grid' | 'horizontal' | 'vertical' | 'scattered';
}

interface EntranceConfig {
  hasCanopy: boolean;
  canopyDepth: number;
  canopyHeight: number;
  entranceWidth: number;
  entranceHeight: number;
  doorCount: number;
  hasRecess: boolean;
}

interface RoofEquipmentConfig {
  unitCount: number;
  unitType: 'ac' | 'antenna' | 'mixed';
  spacing: number;
}

function resolveWindowConfig(
  building: SceneMeta['buildings'][number],
  hint: SceneFacadeHint,
): WindowConfig {
  const archetype = building.visualArchetype ?? 'commercial_midrise';
  const density = hint.windowPatternDensity ?? 'medium';
  const height = Math.max(4, building.heightMeters);

  const floorHeight = 3.2;
  const floorCount = Math.max(2, Math.floor(height / floorHeight));

  const baseConfig: WindowConfig = {
    floorCount,
    windowsPerFloor: 4,
    windowWidth: 1.2,
    windowHeight: 1.8,
    windowDepth: 0.15,
    frameWidth: 0.08,
    sillDepth: 0.12,
    pattern: 'grid',
  };

  switch (archetype) {
    case 'highrise_office':
      return {
        ...baseConfig,
        windowsPerFloor: density === 'dense' ? 8 : density === 'medium' ? 6 : 4,
        windowWidth: 1.4,
        windowHeight: 2.0,
        pattern: 'grid',
      };
    case 'apartment_block':
    case 'house_compact':
      return {
        ...baseConfig,
        windowsPerFloor: density === 'dense' ? 6 : density === 'medium' ? 4 : 3,
        windowWidth: 1.0,
        windowHeight: 1.4,
        pattern: 'grid',
      };
    case 'commercial_midrise':
    case 'mall_podium':
    case 'lowrise_shop':
      return {
        ...baseConfig,
        floorCount: Math.max(1, Math.floor(floorCount * 0.6)),
        windowsPerFloor: density === 'dense' ? 5 : density === 'medium' ? 4 : 3,
        windowWidth: 1.6,
        windowHeight: 1.2,
        pattern: 'horizontal',
      };
    case 'hotel_tower':
      return {
        ...baseConfig,
        windowsPerFloor:
          density === 'dense' ? 10 : density === 'medium' ? 8 : 6,
        windowWidth: 1.1,
        windowHeight: 1.6,
        pattern: 'grid',
      };
    case 'station_like':
    case 'landmark_special':
      return {
        ...baseConfig,
        windowsPerFloor:
          density === 'dense' ? 12 : density === 'medium' ? 8 : 6,
        windowWidth: 1.8,
        windowHeight: 2.2,
        pattern: 'vertical',
      };
    default:
      return baseConfig;
  }
}

function resolveEntranceConfig(
  building: SceneMeta['buildings'][number],
): EntranceConfig {
  const archetype = building.visualArchetype ?? 'commercial_midrise';
  const canopyEdges = building.podiumSpec?.canopyEdges ?? [];
  const hasCanopy = canopyEdges.length > 0;

  const baseConfig: EntranceConfig = {
    hasCanopy: false,
    canopyDepth: 2.0,
    canopyHeight: 3.5,
    entranceWidth: 3.0,
    entranceHeight: 3.0,
    doorCount: 2,
    hasRecess: false,
  };

  switch (archetype) {
    case 'highrise_office':
      return {
        ...baseConfig,
        hasCanopy: true,
        canopyDepth: 2.5,
        canopyHeight: 4.0,
        entranceWidth: 4.0,
        entranceHeight: 3.5,
        doorCount: 3,
        hasRecess: true,
      };
    case 'commercial_midrise':
    case 'mall_podium':
    case 'lowrise_shop':
      return {
        ...baseConfig,
        hasCanopy: hasCanopy || true,
        canopyDepth: 3.0,
        canopyHeight: 3.8,
        entranceWidth: 5.0,
        entranceHeight: 3.2,
        doorCount: 4,
        hasRecess: true,
      };
    case 'apartment_block':
      return {
        ...baseConfig,
        hasCanopy: false,
        entranceWidth: 2.5,
        entranceHeight: 2.8,
        doorCount: 1,
        hasRecess: true,
      };
    case 'hotel_tower':
      return {
        ...baseConfig,
        hasCanopy: true,
        canopyDepth: 4.0,
        canopyHeight: 4.5,
        entranceWidth: 6.0,
        entranceHeight: 4.0,
        doorCount: 4,
        hasRecess: true,
      };
    case 'station_like':
    case 'landmark_special':
      return {
        ...baseConfig,
        hasCanopy: true,
        canopyDepth: 5.0,
        canopyHeight: 5.0,
        entranceWidth: 8.0,
        entranceHeight: 4.5,
        doorCount: 6,
        hasRecess: false,
      };
    default:
      return baseConfig;
  }
}

function resolveRoofEquipmentConfig(
  building: SceneMeta['buildings'][number],
): RoofEquipmentConfig {
  const archetype = building.visualArchetype ?? 'commercial_midrise';
  const explicitUnits = building.roofSpec?.roofUnits ?? 0;
  const height = Math.max(4, building.heightMeters);

  if (explicitUnits > 0) {
    return {
      unitCount: explicitUnits,
      unitType: 'mixed' as const,
      spacing: 2.5,
    };
  }

  const baseConfig: RoofEquipmentConfig = {
    unitCount: 0,
    unitType: 'ac',
    spacing: 2.5,
  };

  switch (archetype) {
    case 'highrise_office':
      return {
        ...baseConfig,
        unitCount: Math.max(2, Math.floor(height / 15)),
        unitType: 'mixed',
      };
    case 'commercial_midrise':
    case 'mall_podium':
      return {
        ...baseConfig,
        unitCount: Math.max(3, Math.floor(height / 10)),
        unitType: 'ac',
      };
    case 'hotel_tower':
      return {
        ...baseConfig,
        unitCount: Math.max(4, Math.floor(height / 12)),
        unitType: 'mixed',
      };
    case 'apartment_block':
      return {
        ...baseConfig,
        unitCount: Math.max(1, Math.floor(height / 20)),
        unitType: 'ac',
      };
    case 'station_like':
    case 'landmark_special':
      return {
        ...baseConfig,
        unitCount: Math.max(2, Math.floor(height / 8)),
        unitType: 'antenna',
      };
    default:
      return baseConfig;
  }
}

function pushWindowGrid(
  geometry: GeometryBuffers,
  frame: FacadeFrame,
  config: WindowConfig,
  buildingHeight: number,
): void {
  const edgeLength = Math.hypot(
    frame.b[0] - frame.a[0],
    frame.b[2] - frame.a[2],
  );

  const floorHeight = buildingHeight / Math.max(1, config.floorCount);
  const windowSpacing = edgeLength / Math.max(1, config.windowsPerFloor);

  for (let floor = 0; floor < config.floorCount; floor += 1) {
    const floorY = floor * floorHeight + floorHeight * 0.3;
    const floorTopY = floorY + config.windowHeight;

    if (floorTopY > buildingHeight - 0.5) {
      continue;
    }

    for (let col = 0; col < config.windowsPerFloor; col += 1) {
      const t = (col + 0.5) / config.windowsPerFloor;
      const centerX = frame.a[0] + (frame.b[0] - frame.a[0]) * t;
      const centerZ = frame.a[2] + (frame.b[2] - frame.a[2]) * t;

      pushWindowFrame(
        geometry,
        frame,
        centerX,
        centerZ,
        floorY,
        config.windowWidth,
        config.windowHeight,
        config.windowDepth,
        config.frameWidth,
        config.sillDepth,
      );
    }
  }
}

function pushWindowFrame(
  geometry: GeometryBuffers,
  frame: FacadeFrame,
  centerX: number,
  centerZ: number,
  floorY: number,
  windowWidth: number,
  windowHeight: number,
  windowDepth: number,
  frameWidth: number,
  sillDepth: number,
): void {
  const edgeDx = frame.b[0] - frame.a[0];
  const edgeDz = frame.b[2] - frame.a[2];
  const edgeLength = Math.hypot(edgeDx, edgeDz);
  if (edgeLength <= 1e-6) {
    return;
  }

  const tangent: Vec3 = [edgeDx / edgeLength, 0, edgeDz / edgeLength];
  const halfWidth = windowWidth / 2;

  const leftX = centerX - tangent[0] * halfWidth;
  const leftZ = centerZ - tangent[2] * halfWidth;
  const rightX = centerX + tangent[0] * halfWidth;
  const rightZ = centerZ + tangent[2] * halfWidth;

  const frontOffset = 0.02;
  const frontLeftX = leftX + frame.normal[0] * frontOffset;
  const frontLeftZ = leftZ + frame.normal[2] * frontOffset;
  const frontRightX = rightX + frame.normal[0] * frontOffset;
  const frontRightZ = rightZ + frame.normal[2] * frontOffset;

  const backLeftX = leftX - frame.normal[0] * windowDepth;
  const backLeftZ = leftZ - frame.normal[2] * windowDepth;
  const backRightX = rightX - frame.normal[0] * windowDepth;
  const backRightZ = rightZ - frame.normal[2] * windowDepth;

  const y0 = floorY;
  const y1 = floorY + windowHeight;

  pushQuad(
    geometry,
    [frontLeftX, y0, frontLeftZ],
    [frontRightX, y0, frontRightZ],
    [frontRightX, y1, frontRightZ],
    [frontLeftX, y1, frontLeftZ],
  );

  pushQuad(
    geometry,
    [backRightX, y0, backRightZ],
    [backLeftX, y0, backLeftZ],
    [backLeftX, y1, backLeftZ],
    [backRightX, y1, backRightZ],
  );

  const frameHalfWidth = frameWidth / 2;
  pushWindowFrameEdge(
    geometry,
    frame,
    leftX,
    leftZ,
    y0,
    y1,
    windowDepth,
    frameHalfWidth,
  );
  pushWindowFrameEdge(
    geometry,
    frame,
    rightX,
    rightZ,
    y0,
    y1,
    windowDepth,
    frameHalfWidth,
  );
  pushWindowSill(
    geometry,
    frame,
    centerX,
    centerZ,
    y0,
    windowWidth,
    windowDepth,
    sillDepth,
  );
}

function pushWindowFrameEdge(
  geometry: GeometryBuffers,
  frame: FacadeFrame,
  x: number,
  z: number,
  y0: number,
  y1: number,
  depth: number,
  halfWidth: number,
): void {
  const frontX = x + frame.normal[0] * 0.02;
  const frontZ = z + frame.normal[2] * 0.02;
  const backX = x - frame.normal[0] * depth;
  const backZ = z - frame.normal[2] * depth;

  pushQuad(
    geometry,
    [
      frontX - frame.normal[0] * halfWidth,
      y0,
      frontZ - frame.normal[2] * halfWidth,
    ],
    [
      backX - frame.normal[0] * halfWidth,
      y0,
      backZ - frame.normal[2] * halfWidth,
    ],
    [
      backX - frame.normal[0] * halfWidth,
      y1,
      backZ - frame.normal[2] * halfWidth,
    ],
    [
      frontX - frame.normal[0] * halfWidth,
      y1,
      frontZ - frame.normal[2] * halfWidth,
    ],
  );
}

function pushWindowSill(
  geometry: GeometryBuffers,
  frame: FacadeFrame,
  centerX: number,
  centerZ: number,
  y: number,
  windowWidth: number,
  windowDepth: number,
  sillDepth: number,
): void {
  const sillHeight = 0.08;
  const sillWidth = windowWidth + 0.1;
  const halfWidth = sillWidth / 2;

  const frontX = centerX + frame.normal[0] * sillDepth;
  const frontZ = centerZ + frame.normal[2] * sillDepth;
  const backX = centerX - frame.normal[0] * (windowDepth + 0.02);
  const backZ = centerZ - frame.normal[2] * (windowDepth + 0.02);

  pushBox(
    geometry,
    [frontX - halfWidth, y - sillHeight, frontZ - halfWidth * 0.3],
    [frontX + halfWidth, y, frontZ + halfWidth * 0.3],
  );
}

function pushEntranceAssembly(
  geometry: GeometryBuffers,
  frame: FacadeFrame,
  config: EntranceConfig,
  buildingHeight: number,
): void {
  const groundY = 0;
  const entranceY = groundY;
  const entranceTopY = Math.min(
    entranceY + config.entranceHeight,
    buildingHeight * 0.15,
  );

  const edgeDx = frame.b[0] - frame.a[0];
  const edgeDz = frame.b[2] - frame.a[2];
  const edgeLength = Math.hypot(edgeDx, edgeDz);
  if (edgeLength <= 1e-6) {
    return;
  }

  const tangent: Vec3 = [edgeDx / edgeLength, 0, edgeDz / edgeLength];
  const centerX = (frame.a[0] + frame.b[0]) / 2;
  const centerZ = (frame.a[2] + frame.b[2]) / 2;

  const halfEntranceWidth = Math.min(
    config.entranceWidth / 2,
    edgeLength * 0.4,
  );

  const leftX = centerX - tangent[0] * halfEntranceWidth;
  const leftZ = centerZ - tangent[2] * halfEntranceWidth;
  const rightX = centerX + tangent[0] * halfEntranceWidth;
  const rightZ = centerZ + tangent[2] * halfEntranceWidth;

  const recessDepth = config.hasRecess ? 0.8 : 0.1;
  const recessLeftX = leftX - frame.normal[0] * recessDepth;
  const recessLeftZ = leftZ - frame.normal[2] * recessDepth;
  const recessRightX = rightX - frame.normal[0] * recessDepth;
  const recessRightZ = rightZ - frame.normal[2] * recessDepth;

  pushQuad(
    geometry,
    [recessLeftX, entranceY, recessLeftZ],
    [recessRightX, entranceY, recessRightZ],
    [recessRightX, entranceTopY, recessRightZ],
    [recessLeftX, entranceTopY, recessLeftZ],
  );

  const doorWidth = config.entranceWidth / Math.max(1, config.doorCount);
  for (let i = 0; i < config.doorCount; i += 1) {
    const doorCenterT = (i + 0.5) / config.doorCount - 0.5;
    const doorCenterX =
      centerX + tangent[0] * doorCenterT * config.entranceWidth;
    const doorCenterZ =
      centerZ + tangent[2] * doorCenterT * config.entranceWidth;

    pushDoorFrame(
      geometry,
      frame,
      doorCenterX,
      doorCenterZ,
      entranceY,
      doorWidth * 0.8,
      entranceTopY * 0.85,
      recessDepth,
    );
  }

  if (config.hasCanopy) {
    pushCanopyStructure(
      geometry,
      frame,
      centerX,
      centerZ,
      entranceTopY,
      config.entranceWidth * 1.2,
      config.canopyDepth,
      config.canopyHeight,
    );
  }
}

function pushDoorFrame(
  geometry: GeometryBuffers,
  frame: FacadeFrame,
  centerX: number,
  centerZ: number,
  y: number,
  doorWidth: number,
  doorHeight: number,
  recessDepth: number,
): void {
  const halfWidth = doorWidth / 2;
  const frameThickness = 0.06;

  const doorFrontX = centerX + frame.normal[0] * 0.02;
  const doorFrontZ = centerZ + frame.normal[2] * 0.02;
  const doorBackX = centerX - frame.normal[0] * recessDepth;
  const doorBackZ = centerZ - frame.normal[2] * recessDepth;

  pushBox(
    geometry,
    [doorFrontX - halfWidth, y, doorFrontZ - halfWidth * 0.3],
    [doorFrontX + halfWidth, y + doorHeight, doorFrontZ + halfWidth * 0.3],
  );

  pushQuad(
    geometry,
    [doorBackX - halfWidth - frameThickness, y, doorBackZ - frameThickness],
    [doorBackX + halfWidth + frameThickness, y, doorBackZ + frameThickness],
    [
      doorBackX + halfWidth + frameThickness,
      y + doorHeight + frameThickness,
      doorBackZ + frameThickness,
    ],
    [
      doorBackX - halfWidth - frameThickness,
      y + doorHeight + frameThickness,
      doorBackZ - frameThickness,
    ],
  );
}

function pushCanopyStructure(
  geometry: GeometryBuffers,
  frame: FacadeFrame,
  centerX: number,
  centerZ: number,
  baseY: number,
  canopyWidth: number,
  canopyDepth: number,
  canopyHeight: number,
): void {
  const halfWidth = canopyWidth / 2;
  const canopyY = baseY + 0.3;
  const canopyTopY = canopyY + canopyHeight;

  const frontX = centerX + frame.normal[0] * canopyDepth;
  const frontZ = centerZ + frame.normal[2] * canopyDepth;
  const backX = centerX - frame.normal[0] * 0.1;
  const backZ = centerZ - frame.normal[2] * 0.1;

  pushBox(
    geometry,
    [frontX - halfWidth, canopyY, frontZ - 0.15],
    [frontX + halfWidth, canopyTopY, frontZ + 0.15],
  );

  const supportSpacing = canopyWidth / 3;
  for (let i = -1; i <= 1; i += 1) {
    const supportX = centerX + (frame.b[0] - frame.a[0]) * (i / 3);
    const supportZ = centerX + (frame.b[2] - frame.a[2]) * (i / 3);

    pushBox(
      geometry,
      [supportX - 0.08, 0, supportZ - 0.08],
      [supportX + 0.08, canopyY, supportZ + 0.08],
    );
  }
}

function pushRoofEquipmentAssembly(
  geometry: GeometryBuffers,
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    width: number;
    depth: number;
  },
  topHeight: number,
  config: RoofEquipmentConfig,
): void {
  const columns = Math.max(1, Math.ceil(Math.sqrt(config.unitCount)));
  const rows = Math.ceil(config.unitCount / columns);

  for (let index = 0; index < config.unitCount; index += 1) {
    const col = index % columns;
    const row = Math.floor(index / columns);

    const centerX = bounds.minX + ((col + 1) / (columns + 1)) * bounds.width;
    const centerZ = bounds.minZ + ((row + 1) / (rows + 1)) * bounds.depth;

    if (config.unitType === 'antenna') {
      pushAntennaUnit(geometry, centerX, centerZ, topHeight);
    } else if (config.unitType === 'ac') {
      pushACUnit(geometry, centerX, centerZ, topHeight);
    } else {
      if (index % 2 === 0) {
        pushACUnit(geometry, centerX, centerZ, topHeight);
      } else {
        pushAntennaUnit(geometry, centerX, centerZ, topHeight);
      }
    }
  }
}

function pushACUnit(
  geometry: GeometryBuffers,
  centerX: number,
  centerZ: number,
  baseY: number,
): void {
  const unitWidth = 1.4;
  const unitDepth = 0.8;
  const unitHeight = 1.2;

  pushBox(
    geometry,
    [centerX - unitWidth / 2, baseY + 0.1, centerZ - unitDepth / 2],
    [
      centerX + unitWidth / 2,
      baseY + 0.1 + unitHeight,
      centerZ + unitDepth / 2,
    ],
  );

  const fanRadius = 0.25;
  for (let i = 0; i < 2; i += 1) {
    const fanX = centerX + (i - 0.5) * 0.5;
    pushBox(
      geometry,
      [fanX - fanRadius, baseY + 0.1 + unitHeight - 0.05, centerZ - fanRadius],
      [fanX + fanRadius, baseY + 0.1 + unitHeight + 0.05, centerZ + fanRadius],
    );
  }
}

function pushAntennaUnit(
  geometry: GeometryBuffers,
  centerX: number,
  centerZ: number,
  baseY: number,
): void {
  const poleHeight = 2.5;
  const poleRadius = 0.06;

  pushBox(
    geometry,
    [centerX - poleRadius, baseY + 0.1, centerZ - poleRadius],
    [centerX + poleRadius, baseY + 0.1 + poleHeight, centerZ + poleRadius],
  );

  const dishRadius = 0.4;
  const dishHeight = 0.3;
  pushBox(
    geometry,
    [
      centerX - dishRadius,
      baseY + 0.1 + poleHeight * 0.6,
      centerZ - dishRadius,
    ],
    [
      centerX + dishRadius,
      baseY + 0.1 + poleHeight * 0.6 + dishHeight,
      centerZ + dishRadius,
    ],
  );

  const topBoxSize = 0.15;
  pushBox(
    geometry,
    [
      centerX - topBoxSize,
      baseY + 0.1 + poleHeight - 0.1,
      centerZ - topBoxSize,
    ],
    [
      centerX + topBoxSize,
      baseY + 0.1 + poleHeight + 0.1,
      centerZ + topBoxSize,
    ],
  );
}
