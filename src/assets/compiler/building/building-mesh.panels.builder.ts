import type { Coordinate } from '../../../places/types/place.types';
import type {
  SceneFacadeHint,
  SceneMeta,
} from '../../../scene/types/scene.types';
import type { AccentTone } from '../materials/glb-material-factory';
import type { GeometryBuffers } from '../road/road-mesh.builder';
import { createEmptyGeometry } from '../road/road-mesh.builder';
import { normalizeLocalRing, toLocalRing } from './building-mesh-utils';
import {
  buildFacadeFrame,
  type FacadeFrame,
  resolveFacadeBackingDepth,
  resolveLongestEdgeIndex,
  pushFacadeBacking,
  splitFacadeFrame,
} from './building-mesh.facade-frame.utils';
import {
  pushCanopyBand,
  pushFacadeBandByType,
  pushHorizontalBands,
  pushSignBands,
  pushTopBillboardZone,
  pushVerticalMullions,
} from './building-mesh.facade-band.utils';
import { resolveAccentTone } from './building-mesh.tone.utils';

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
  const patternIntensity = resolvePatternIntensity(hint);

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
      Math.max(2, Math.floor(bandCount * 0.22 * patternIntensity)),
    );
    pushFacadeBandByType(
      geometry,
      midFrame,
      hint.facadeSpec.midBandType,
      Math.max(1, signBandLevels),
      glazing,
      repeatX,
      Math.max(3, Math.floor(bandCount * 0.56 * patternIntensity)),
    );
    pushFacadeBandByType(
      geometry,
      topFrame,
      hint.facadeSpec.topBandType,
      Math.max(1, Math.min(2, signBandLevels || 1)),
      glazing,
      repeatX,
      Math.max(2, Math.floor(bandCount * 0.22 * patternIntensity)),
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
      pushHorizontalBands(
        geometry,
        frame,
        Math.max(2, Math.round(bandCount * patternIntensity)),
        0.42,
        0.55,
      );
      pushVerticalMullions(
        geometry,
        frame,
        hint.windowPatternDensity ?? 'dense',
        glazing,
        repeatX,
      );
      break;
    case 'retail_sign_band':
      pushSignBands(
        geometry,
        frame,
        Math.max(2, Math.round((signBandLevels || 2) * patternIntensity)),
        1.25,
      );
      pushHorizontalBands(
        geometry,
        frame,
        Math.max(2, Math.round((bandCount - 1) * patternIntensity)),
        0.26,
        0.58,
      );
      break;
    case 'mall_panel':
      pushSignBands(
        geometry,
        frame,
        Math.max(3, Math.round((signBandLevels || 3) * patternIntensity)),
        1.5,
      );
      pushHorizontalBands(
        geometry,
        frame,
        Math.max(2, Math.floor((bandCount / 2) * patternIntensity)),
        0.84,
        0.68,
      );
      if (hint.billboardEligible) {
        pushTopBillboardZone(geometry, frame);
      }
      break;
    case 'brick_lowrise':
      pushHorizontalBands(
        geometry,
        frame,
        Math.min(4, Math.max(2, Math.round(bandCount * patternIntensity))),
        0.2,
        0.46,
      );
      if (signBandLevels > 0) {
        pushSignBands(geometry, frame, 1, 1.05);
      }
      break;
    case 'station_metal':
      pushHorizontalBands(
        geometry,
        frame,
        Math.max(2, Math.floor((bandCount / 2) * patternIntensity)),
        0.76,
        0.62,
      );
      pushCanopyBand(geometry, frame, Math.max(3, buildingHeight * 0.16));
      break;
    case 'concrete_repetitive':
    default:
      pushHorizontalBands(
        geometry,
        frame,
        Math.max(2, Math.round(bandCount * patternIntensity)),
        0.3,
        0.52,
      );
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

function resolvePatternIntensity(hint: SceneFacadeHint): number {
  if (hint.visualRole && hint.visualRole !== 'generic') {
    return 1.24;
  }
  if (hint.signageDensity === 'high') {
    return 1.18;
  }
  if (hint.windowPatternDensity === 'dense') {
    return 1.12;
  }
  if (hint.windowPatternDensity === 'sparse') {
    return 0.95;
  }
  return 1;
}
