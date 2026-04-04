import { polygonSignedArea } from '../places/geo.utils';
import { BuildingData, Coordinate } from '../places/place.types';
import { BuildingPreset, MaterialClass, RoofType } from './scene.types';

export interface BuildingStyleInput {
  usage: BuildingData['usage'];
  heightMeters: number;
  facadeMaterial?: string | null;
  roofMaterial?: string | null;
  facadeColor?: string | null;
  roofColor?: string | null;
  roofShape?: string | null;
  buildingPart?: string | null;
  outerRing: Coordinate[];
}

export interface BuildingStyleProfile {
  preset: BuildingPreset;
  roofType: RoofType;
  materialClass: MaterialClass;
  palette: string[];
  signageDensity: 'low' | 'medium' | 'high';
  emissiveStrength: number;
  glazingRatio: number;
  windowBands: number;
  billboardEligible: boolean;
}

export function resolveBuildingStyle(input: BuildingStyleInput): BuildingStyleProfile {
  const preset = classifyBuildingPreset(input);
  const materialClass = resolveMaterialClass(input, preset);
  const roofType = resolveRoofType(input, preset);
  const palette = resolvePalette(input, materialClass, preset);
  const signageDensity = resolveSignageDensity(input, preset);
  const emissiveStrength =
    signageDensity === 'high' ? 1 : signageDensity === 'medium' ? 0.6 : 0.15;
  const glazingRatio =
    preset === 'glass_tower'
      ? 0.72
      : preset === 'office_midrise'
        ? 0.48
        : preset === 'mall_block'
          ? 0.28
          : materialClass === 'glass'
            ? 0.55
            : materialClass === 'metal'
              ? 0.35
              : 0.18;
  const floors = Math.max(1, Math.floor(input.heightMeters / 3.4));
  const windowBands =
    preset === 'mall_block'
      ? Math.min(6, Math.max(2, Math.ceil(floors / 2)))
      : preset === 'glass_tower'
        ? Math.min(18, Math.max(6, floors))
        : preset === 'small_lowrise'
          ? Math.min(3, floors)
          : Math.min(12, Math.max(3, floors - 1));

  return {
    preset,
    roofType,
    materialClass,
    palette,
    signageDensity,
    emissiveStrength,
    glazingRatio,
    windowBands,
    billboardEligible:
      (signageDensity === 'high' ||
        (preset === 'glass_tower' && input.usage === 'COMMERCIAL')) &&
      (preset === 'glass_tower' || preset === 'mall_block' || preset === 'station_block'),
  };
}

export function estimateFacadeEdgeIndex(ring: Coordinate[]): number | null {
  if (ring.length < 2) {
    return null;
  }

  let longestIndex = 0;
  let longestLength = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    const length = Math.hypot(
      (next.lng - current.lng) * 111_320,
      (next.lat - current.lat) * 111_320,
    );
    if (length > longestLength) {
      longestLength = length;
      longestIndex = index;
    }
  }

  return longestLength > 0 ? longestIndex : null;
}

export function resolveMaterialClass(
  input: BuildingStyleInput,
  preset?: BuildingPreset,
): MaterialClass {
  const rawMaterial = `${input.facadeMaterial ?? ''} ${input.roofMaterial ?? ''}`.toLowerCase();

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

  switch (preset) {
    case 'glass_tower':
      return 'glass';
    case 'mall_block':
    case 'station_block':
      return 'concrete';
    case 'small_lowrise':
      return 'brick';
    default:
      return input.usage === 'COMMERCIAL' ? 'glass' : 'mixed';
  }
}

export function resolveRoofType(
  input: BuildingStyleInput,
  preset?: BuildingPreset,
): RoofType {
  const normalizedRoof = (input.roofShape ?? '').toLowerCase();
  if (normalizedRoof.includes('gable') || normalizedRoof.includes('hipped')) {
    return 'gable';
  }
  if (normalizedRoof.includes('stepped') || normalizedRoof.includes('tiered')) {
    return 'stepped';
  }
  if (normalizedRoof.includes('flat') || normalizedRoof.length > 0) {
    return 'flat';
  }

  switch (preset) {
    case 'glass_tower':
    case 'station_block':
      return 'stepped';
    case 'mall_block':
    case 'office_midrise':
    case 'mixed_midrise':
      return 'flat';
    case 'small_lowrise':
      return 'gable';
    default:
      return 'flat';
  }
}

export function normalizeColor(value: string): string {
  if (value.startsWith('#')) {
    return value.toLowerCase();
  }

  const paletteMap: Record<string, string> = {
    gray: '#9ea4aa',
    grey: '#9ea4aa',
    white: '#f2f2f2',
    black: '#1f1f1f',
    blue: '#4d79c7',
    red: '#cc5a4f',
    brown: '#8d5a44',
    beige: '#d6c0a7',
    green: '#5c8b61',
    silver: '#b9c0c7',
    concrete: '#aab1b8',
    brick: '#a65b42',
  };

  return paletteMap[value.toLowerCase()] ?? '#9ea4aa';
}

function classifyBuildingPreset(input: BuildingStyleInput): BuildingPreset {
  const area = Math.abs(polygonSignedArea(input.outerRing)) * 111_320 * 111_320;
  const material = `${input.facadeMaterial ?? ''} ${input.roofMaterial ?? ''}`.toLowerCase();

  if (input.usage === 'TRANSIT') {
    return 'station_block';
  }
  if (
    input.heightMeters >= 60 ||
    (input.heightMeters >= 38 && (material.includes('glass') || input.usage === 'COMMERCIAL'))
  ) {
    return 'glass_tower';
  }
  if (input.usage === 'COMMERCIAL' && area >= 1_600) {
    return 'mall_block';
  }
  if (input.heightMeters >= 24) {
    return input.usage === 'COMMERCIAL' ? 'office_midrise' : 'mixed_midrise';
  }
  if (input.heightMeters <= 12 && area <= 1_800) {
    return 'small_lowrise';
  }

  return 'mixed_midrise';
}

function resolvePalette(
  input: BuildingStyleInput,
  materialClass: MaterialClass,
  preset: BuildingPreset,
): string[] {
  const explicit = [input.facadeColor, input.roofColor]
    .filter((value): value is string => Boolean(value))
    .map(normalizeColor);
  if (explicit.length > 0) {
    return [...new Set(explicit)].slice(0, 3);
  }

  switch (materialClass) {
    case 'glass':
      return preset === 'glass_tower'
        ? ['#7da7cf', '#cfe3f1', '#eaf3fb']
        : ['#8eb7d9', '#d9ebf5', '#edf5fb'];
    case 'brick':
      return ['#8d4d38', '#b97856', '#dcc0aa'];
    case 'metal':
      return ['#7e8891', '#b7c0c7', '#d8dee3'];
    case 'concrete':
      return ['#9fa6ad', '#c9cdd1', '#ebecee'];
    default:
      return ['#9ea4aa', '#d3d6da', '#eceff1'];
  }
}

function resolveSignageDensity(
  input: BuildingStyleInput,
  preset: BuildingPreset,
): 'low' | 'medium' | 'high' {
  if (preset === 'mall_block' || preset === 'station_block') {
    return 'high';
  }
  if (preset === 'glass_tower' || preset === 'office_midrise') {
    return input.usage === 'COMMERCIAL' ? 'medium' : 'low';
  }

  return input.usage === 'COMMERCIAL' ? 'medium' : 'low';
}
