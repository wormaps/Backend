import { AccentTone, ShellColorBucket } from '../../compiler/materials';
import {
  groupBillboardClustersByColor,
  groupFacadeHintsByPanelColor,
  resolveAccentToneFromPalette,
  resolveBuildingShellStyleFromHint,
} from './glb-build-style.utils';
import { GroupedBuildings } from './glb-build-stage.types';
import {
  MaterialClass,
  SceneDetail,
  SceneFacadeHint,
  SceneMeta,
} from '../../../scene/types/scene.types';
import type { SceneAssetSelection } from '../../../scene/services/asset-profile';

export interface FacadeColorDiversityMetrics {
  facadeHintCount: number;
  uniqueMainColorCount: number;
  uniqueAccentColorCount: number;
  uniqueTrimColorCount: number;
  uniqueRoofColorCount: number;
  uniqueShellPaletteColorCount: number;
  uniquePanelPaletteColorCount: number;
  neutralToneRatio: number;
  shellGroupCount: number;
  panelGroupCount: number;
}

export function resolveBuildingShellStyle(
  building: SceneMeta['buildings'][number],
  hint?: SceneFacadeHint,
): {
  key: string;
  materialClass: MaterialClass;
  bucket: ShellColorBucket;
  colorHex: string;
} {
  return resolveBuildingShellStyleFromHint(building, hint);
}

export function groupFacadeHintsByPanelColorLocal(
  facadeHints: SceneDetail['facadeHints'],
): Array<{
  groupKey: string;
  tone: AccentTone;
  colorHex: string;
  hints: SceneDetail['facadeHints'];
}> {
  return groupFacadeHintsByPanelColor(facadeHints);
}

export function groupBillboardClustersByColorLocal(
  selectedClusters: SceneDetail['signageClusters'],
  sourceClusters: SceneDetail['signageClusters'],
): Array<{
  tone: AccentTone;
  colorHex: string;
  selectedClusters: SceneDetail['signageClusters'];
  sourceCount: number;
}> {
  return groupBillboardClustersByColor(selectedClusters, sourceClusters);
}

export function resolveWindowMaterialTone(
  facadeHints: SceneDetail['facadeHints'],
): AccentTone {
  const palettes = facadeHints.flatMap((hint) =>
    hint.panelPalette?.length ? hint.panelPalette : hint.palette,
  );
  return resolveAccentToneFromPalette(palettes);
}

export function resolveHeroToneFromBuildings(
  buildings: SceneMeta['buildings'],
): AccentTone {
  const colorPalette = buildings
    .flatMap((building) => [building.facadeColor, building.roofColor])
    .filter((color): color is string => Boolean(color));
  return resolveAccentToneFromPalette(colorPalette);
}

export function buildGroupedBuildingShellsLocal(
  sceneDetail: SceneDetail,
  assetSelection: SceneAssetSelection,
): GroupedBuildings {
  const materialHintMap = new Map(
    sceneDetail.facadeHints.map((hint) => [hint.objectId, hint]),
  );

  const groupedBuildings: GroupedBuildings = new Map();
  for (const building of assetSelection.buildings) {
    const hint = materialHintMap.get(building.objectId);
    const style = resolveBuildingShellStyle(building, hint);
    const current = groupedBuildings.get(style.key) ?? {
      materialClass: style.materialClass,
      bucket: style.bucket,
      colorHex: style.colorHex,
      buildings: [],
    };
    current.buildings.push(building);
    groupedBuildings.set(style.key, current);
  }

  return groupedBuildings;
}

export function buildFacadeColorDiversityMetrics(
  sceneDetail: SceneDetail,
  groupedBuildings: GroupedBuildings,
): FacadeColorDiversityMetrics {
  const hints = sceneDetail.facadeHints;
  const uniqueMainColorCount = new Set(
    hints
      .map((hint) => hint.mainColor)
      .filter((value): value is string => Boolean(value)),
  ).size;
  const uniqueAccentColorCount = new Set(
    hints
      .map((hint) => hint.accentColor)
      .filter((value): value is string => Boolean(value)),
  ).size;
  const uniqueTrimColorCount = new Set(
    hints
      .map((hint) => hint.trimColor)
      .filter((value): value is string => Boolean(value)),
  ).size;
  const uniqueRoofColorCount = new Set(
    hints
      .map((hint) => hint.roofColor)
      .filter((value): value is string => Boolean(value)),
  ).size;
  const uniqueShellPaletteColorCount = new Set(
    hints.flatMap((hint) => hint.shellPalette ?? []),
  ).size;
  const uniquePanelPaletteColorCount = new Set(
    hints.flatMap((hint) => hint.panelPalette ?? []),
  ).size;
  const neutralCount = hints.filter(
    (hint) =>
      resolveAccentToneFromPalette(
        hint.panelPalette?.length ? hint.panelPalette : hint.palette,
      ) === 'neutral',
  ).length;

  return {
    facadeHintCount: hints.length,
    uniqueMainColorCount,
    uniqueAccentColorCount,
    uniqueTrimColorCount,
    uniqueRoofColorCount,
    uniqueShellPaletteColorCount,
    uniquePanelPaletteColorCount,
    neutralToneRatio:
      hints.length > 0 ? Number((neutralCount / hints.length).toFixed(3)) : 0,
    shellGroupCount: groupedBuildings.size,
    panelGroupCount: groupFacadeHintsByPanelColor(sceneDetail.facadeHints)
      .length,
  };
}
