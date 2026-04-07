import { normalizeColor } from '../../../scene/utils/scene-building-style.utils';
import {
  MaterialClass,
  SceneDetail,
  SceneFacadeHint,
  SceneMeta,
} from '../../../scene/types/scene.types';
import { AccentTone, ShellColorBucket } from '../../compiler/materials';

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const safe =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;
  const value = Number.parseInt(safe, 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

export function resolveAccentToneFromPalette(palette: string[]): AccentTone {
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

export function resolveShellColorBucketFromColor(
  color: string,
  materialClass: MaterialClass,
): ShellColorBucket {
  if (materialClass === 'brick') {
    return 'brick';
  }

  const [r, g, b] = hexToRgb(color);
  const luminance = r * 0.299 + g * 0.587 + b * 0.114;
  const warmDelta = r - Math.max(g, b);
  const coolDelta = b - Math.max(r, g);

  if (coolDelta >= 0.04) {
    return luminance >= 0.7 ? 'cool-light' : 'cool-mid';
  }
  if (warmDelta >= 0.04) {
    return luminance >= 0.66 ? 'warm-light' : 'warm-mid';
  }
  if (luminance >= 0.78) {
    return 'neutral-light';
  }
  if (luminance >= 0.48) {
    return 'neutral-mid';
  }
  return 'neutral-dark';
}

const SHELL_COLOR_POOL: Record<MaterialClass, string[]> = {
  glass: ['#5b8db8', '#4a7ca7', '#3d6b96', '#6d9ec9', '#7badd4'],
  concrete: ['#a0a8b0', '#8c949c', '#787f87', '#949da6', '#6e767e'],
  brick: ['#a65b42', '#8c4a35', '#b87a5c', '#7a3d2a', '#c48e70'],
  metal: ['#6b7680', '#8b949d', '#5a6670', '#7d8a95', '#4e5a64'],
  mixed: ['#7e868c', '#8a929a', '#6e767e', '#9ea4aa', '#5e666e'],
};

export function defaultShellColorForMaterialClass(
  materialClass: MaterialClass,
  seed?: string,
): string {
  const pool = SHELL_COLOR_POOL[materialClass] ?? SHELL_COLOR_POOL.mixed;
  if (!seed) {
    return pool[0];
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}

export function resolveMaterialClassFromBuilding(
  building: SceneMeta['buildings'][number],
): MaterialClass {
  const rawMaterial =
    `${building.facadeMaterial ?? ''} ${building.roofMaterial ?? ''}`.toLowerCase();

  if (rawMaterial.includes('glass')) {
    return 'glass';
  }
  if (rawMaterial.includes('brick')) {
    return 'brick';
  }
  if (rawMaterial.includes('metal') || rawMaterial.includes('steel')) {
    return 'metal';
  }
  if (rawMaterial.includes('concrete') || rawMaterial.includes('cement')) {
    return 'concrete';
  }

  switch (building.preset) {
    case 'glass_tower':
      return 'glass';
    case 'mall_block':
    case 'station_block':
      return 'concrete';
    case 'small_lowrise':
      return 'brick';
    default:
      return building.usage === 'COMMERCIAL' ? 'glass' : 'mixed';
  }
}

export function resolveBuildingAccentToneFromBuilding(
  building: SceneMeta['buildings'][number],
): AccentTone {
  const explicit = building.roofColor ?? building.facadeColor;
  if (!explicit) {
    return building.preset === 'glass_tower' ? 'cool' : 'neutral';
  }

  return resolveAccentToneFromPalette([normalizeColor(explicit)]);
}

export function resolveBuildingShellStyleFromHint(
  building: SceneMeta['buildings'][number],
  hint?: SceneFacadeHint,
): {
  key: string;
  materialClass: MaterialClass;
  bucket: ShellColorBucket;
  colorHex: string;
} {
  const materialClass =
    hint?.materialClass ?? resolveMaterialClassFromBuilding(building);
  const rawColor =
    hint?.shellPalette?.[0] ??
    building.facadeColor ??
    building.roofColor ??
    hint?.palette.find(Boolean) ??
    defaultShellColorForMaterialClass(materialClass, building.objectId);
  const normalizedColor = normalizeColor(rawColor);
  const bucket = resolveShellColorBucketFromColor(
    normalizedColor,
    materialClass,
  );

  return {
    key: `${materialClass}_${normalizedColor}`,
    materialClass,
    bucket,
    colorHex: normalizedColor,
  };
}

export function groupFacadeHintsByPanelColor(
  facadeHints: SceneDetail['facadeHints'],
): Array<{
  tone: AccentTone;
  colorHex: string;
  hints: SceneDetail['facadeHints'];
}> {
  const groups = new Map<
    string,
    { tone: AccentTone; colorHex: string; hints: SceneDetail['facadeHints'] }
  >();
  for (const hint of facadeHints) {
    const paletteSource = hint.panelPalette?.length
      ? hint.panelPalette
      : hint.palette;
    const colorHex = normalizeColor(paletteSource[0] ?? '#5a6470');
    const tone = resolveAccentToneFromPalette(paletteSource);
    const key = `${tone}:${colorHex}`;
    const current = groups.get(key) ?? { tone, colorHex, hints: [] };
    current.hints.push(hint);
    groups.set(key, current);
  }
  return [...groups.values()];
}

export function groupBillboardClustersByColor(
  selectedClusters: SceneDetail['signageClusters'],
  sourceClusters: SceneDetail['signageClusters'],
): Array<{
  tone: AccentTone;
  colorHex: string;
  selectedClusters: SceneDetail['signageClusters'];
  sourceCount: number;
}> {
  const sourceCountMap = new Map<string, number>();
  for (const cluster of sourceClusters) {
    const colorHex = normalizeColor(cluster.palette[0] ?? '#d9d9d9');
    const tone = resolveAccentToneFromPalette(cluster.palette);
    const key = `${tone}:${colorHex}`;
    sourceCountMap.set(key, (sourceCountMap.get(key) ?? 0) + 1);
  }

  const groups = new Map<
    string,
    {
      tone: AccentTone;
      colorHex: string;
      selectedClusters: SceneDetail['signageClusters'];
      sourceCount: number;
    }
  >();
  for (const cluster of selectedClusters) {
    const colorHex = normalizeColor(cluster.palette[0] ?? '#d9d9d9');
    const tone = resolveAccentToneFromPalette(cluster.palette);
    const key = `${tone}:${colorHex}`;
    const current = groups.get(key) ?? {
      tone,
      colorHex,
      selectedClusters: [],
      sourceCount: sourceCountMap.get(key) ?? 0,
    };
    current.selectedClusters.push(cluster);
    groups.set(key, current);
  }
  return [...groups.values()];
}
