import type { Coordinate } from '../../places/types/place.types';
import type { SceneFacadeHint, SceneMeta } from '../../scene/types/scene.types';
import type { AccentTone } from './glb-material-factory';
import type { GeometryBuffers } from './road-mesh.builder';
import { createEmptyGeometry } from './road-mesh.builder';
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
