import { Injectable } from '@nestjs/common';
import { polygonSignedArea } from '../../../places/utils/geo.utils';
import { BuildingData, Coordinate } from '../../../places/types/place.types';
import {
  BuildingPreset,
  FacadePreset,
  GeometryStrategy,
  MaterialClass,
  RoofAccentType,
  RoofType,
  VisualArchetype,
  WindowPatternDensity,
} from '../../types/scene.types';

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
  osmAttributes?: Record<string, string>;
  googlePlacesInfo?: {
    placeId: string;
    primaryType?: string | null;
    types?: string[];
  } | null;
  nearbyImageCount?: number;
  nearbyFeatureCount?: number;
}

export interface BuildingStyleProfile {
  preset: BuildingPreset;
  roofType: RoofType;
  materialClass: MaterialClass;
  palette: string[];
  shellPalette: string[];
  panelPalette: string[];
  signageDensity: 'low' | 'medium' | 'high';
  emissiveStrength: number;
  glazingRatio: number;
  windowBands: number;
  billboardEligible: boolean;
  visualArchetype: VisualArchetype;
  geometryStrategy: GeometryStrategy;
  facadePreset: FacadePreset;
  podiumLevels: number;
  setbackLevels: number;
  cornerChamfer: boolean;
  roofAccentType: RoofAccentType;
  windowPatternDensity: WindowPatternDensity;
  signBandLevels: number;
}

const MATERIAL_CLASS_PALETTE_POOL: Record<MaterialClass, string[][]> = {
  glass: [
    ['#7da7cf', '#cfe3f1', '#eaf3fb'],
    ['#6f9dc8', '#bfd8ee', '#e6f1fb'],
    ['#5c8fba', '#b4d0ea', '#e3eef8'],
    ['#86b0d4', '#d7e8f4', '#eff6fb'],
    ['#4a6a8a', '#8aaaca', '#c0d8e8'],
    ['#7a8a6a', '#aabaa0', '#d4e2cc'],
    ['#6a5a7a', '#9a8aaa', '#c8bed8'],
    ['#8a7a5a', '#baa888', '#e2d4c0'],
  ],
  concrete: [
    ['#9fa6ad', '#c9cdd1', '#ebecee'],
    ['#8f979f', '#bec4cb', '#e3e6ea'],
    ['#a7afb6', '#d3d8dc', '#f0f1f2'],
    ['#8a9299', '#b8bec4', '#dde1e6'],
    ['#b5b0a8', '#d4d0ca', '#efedea'],
    ['#8a8f94', '#b3b8bd', '#dce0e3'],
    ['#a09590', '#c8c0bb', '#e8e4e0'],
    ['#929a8e', '#bcc3b6', '#e0e4dc'],
  ],
  brick: [
    ['#8d4d38', '#b97856', '#dcc0aa'],
    ['#7c4332', '#a7684b', '#d2b099'],
    ['#9c5c43', '#c48663', '#e2c7b1'],
    ['#884c3d', '#b87963', '#d9beaa'],
    ['#a86b4f', '#d4a08a', '#f0d4c0'],
    ['#6d3d2e', '#996650', '#c4a088'],
    ['#c4785a', '#e0a88c', '#f5ddd0'],
    ['#7a4035', '#a86858', '#d4a898'],
  ],
  metal: [
    ['#7e8891', '#b7c0c7', '#d8dee3'],
    ['#6e7983', '#aab4bd', '#cfd6dc'],
    ['#87929d', '#c0c8cf', '#e1e6ea'],
    ['#697680', '#9eaab5', '#c9d1d8'],
    ['#8a8078', '#b0a8a0', '#d4cec8'],
    ['#606870', '#8890a0', '#b8c0c8'],
    ['#909898', '#b8c0c0', '#dce2e2'],
    ['#787068', '#a09890', '#c8c2bc'],
  ],
  mixed: [
    ['#9ea4aa', '#d3d6da', '#eceff1'],
    ['#8f979e', '#c7ccd1', '#e6e9ec'],
    ['#a7adb3', '#d9dde0', '#f0f2f4'],
    ['#9299a1', '#cdd2d7', '#e9ecef'],
    ['#b0a8a0', '#d0cac4', '#eae6e2'],
    ['#888e92', '#b0b6ba', '#d8dce0'],
    ['#a49890', '#ccc2ba', '#e8e2dc'],
    ['#969e94', '#bec6ba', '#e0e6dc'],
  ],
};

@Injectable()
export class BuildingStyleResolverService {
  resolveBuildingStyle(input: BuildingStyleInput): BuildingStyleProfile {
    const preset = this.classifyBuildingPreset(input);
    const materialClass = this.resolveMaterialClass(input, preset);
    const roofType = this.resolveRoofType(input, preset);
    const palette = this.resolvePalette(input, materialClass, preset);
    const visualArchetype = this.resolveVisualArchetype(input, preset);
    const geometryStrategy = this.resolveGeometryStrategy(
      input,
      preset,
      roofType,
    );
    const facadePreset = this.resolveFacadePreset(
      visualArchetype,
      materialClass,
    );
    const signageDensity = this.resolveSignageDensity(input, preset);
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
    const podiumLevels = this.resolvePodiumLevels(visualArchetype, floors);
    const setbackLevels = this.resolveSetbackLevels(geometryStrategy, floors);
    const cornerChamfer = this.resolveCornerChamfer(
      visualArchetype,
      input,
      floors,
    );
    const roofAccentType = this.resolveRoofAccentType(
      geometryStrategy,
      roofType,
    );
    const windowPatternDensity = this.resolveWindowPatternDensity(
      facadePreset,
      floors,
    );
    const signBandLevels = this.resolveSignBandLevels(
      visualArchetype,
      signageDensity,
    );
    const shellPalette = palette.slice(0, 2);
    const panelPalette = this.resolvePanelPalette(palette, facadePreset);

    return {
      preset,
      roofType,
      materialClass,
      palette,
      shellPalette,
      panelPalette,
      signageDensity,
      emissiveStrength,
      glazingRatio,
      windowBands,
      billboardEligible:
        (signageDensity === 'high' ||
          (preset === 'glass_tower' && input.usage === 'COMMERCIAL')) &&
        (preset === 'glass_tower' ||
          preset === 'mall_block' ||
          preset === 'station_block'),
      visualArchetype,
      geometryStrategy,
      facadePreset,
      podiumLevels,
      setbackLevels,
      cornerChamfer,
      roofAccentType,
      windowPatternDensity,
      signBandLevels,
    };
  }

  estimateFacadeEdgeIndex(ring: Coordinate[]): number | null {
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

  resolveMaterialClass(
    input: BuildingStyleInput,
    preset?: BuildingPreset,
  ): MaterialClass {
    const rawMaterial =
      `${input.facadeMaterial ?? ''} ${input.roofMaterial ?? ''}`.toLowerCase();

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
        if (input.usage === 'PUBLIC') {
          return 'concrete';
        }
        if (input.usage === 'COMMERCIAL') {
          return 'brick';
        }
        return 'brick';
      default:
        if (
          input.osmAttributes &&
          Object.keys(input.osmAttributes).length > 0
        ) {
          return input.usage === 'COMMERCIAL' ? 'glass' : 'mixed';
        }
        if (input.googlePlacesInfo) {
          return input.usage === 'COMMERCIAL' ? 'glass' : 'mixed';
        }
        return input.usage === 'COMMERCIAL' ? 'glass' : 'mixed';
    }
  }

  determineEvidenceStrength(
    input: BuildingStyleInput,
  ): 'STRONG' | 'MODERATE' | 'WEAK' {
    if (
      (input.nearbyImageCount ?? 0) > 0 &&
      (input.nearbyFeatureCount ?? 0) > 0
    ) {
      return 'STRONG';
    }
    if (input.osmAttributes && Object.keys(input.osmAttributes).length > 0) {
      return 'MODERATE';
    }
    if (input.googlePlacesInfo) {
      return 'MODERATE';
    }
    return 'WEAK';
  }

  resolveRoofType(
    input: BuildingStyleInput,
    preset?: BuildingPreset,
  ): RoofType {
    const normalizedRoof = (input.roofShape ?? '').toLowerCase();
    if (normalizedRoof.includes('gable') || normalizedRoof.includes('hipped')) {
      return 'gable';
    }
    if (
      normalizedRoof.includes('stepped') ||
      normalizedRoof.includes('tiered')
    ) {
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

  normalizeColor(value: string): string {
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

  private classifyBuildingPreset(input: BuildingStyleInput): BuildingPreset {
    const area =
      Math.abs(polygonSignedArea(input.outerRing)) * 111_320 * 111_320;
    const material =
      `${input.facadeMaterial ?? ''} ${input.roofMaterial ?? ''}`.toLowerCase();

    if (input.usage === 'TRANSIT') {
      return 'station_block';
    }
    if (
      input.heightMeters >= 60 ||
      (input.heightMeters >= 38 &&
        (material.includes('glass') || input.usage === 'COMMERCIAL'))
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

  private resolvePalette(
    input: BuildingStyleInput,
    materialClass: MaterialClass,
    preset: BuildingPreset,
  ): string[] {
    const explicit = [input.facadeColor, input.roofColor]
      .filter((value): value is string => Boolean(value))
      .map((value) => this.normalizeColor(value));
    if (explicit.length > 0) {
      return [...new Set(explicit)].slice(0, 3);
    }

    const pool =
      MATERIAL_CLASS_PALETTE_POOL[materialClass] ??
      MATERIAL_CLASS_PALETTE_POOL.mixed;
    const variant =
      pool[
        resolvePaletteVariantIndex({
          input,
          preset,
          materialClass,
          poolSize: pool.length,
        })
      ] ?? pool[0];
    if (materialClass === 'glass' && preset === 'glass_tower') {
      return uniquePalette([
        mixHex(variant[0], '#6f9dc8', 0.22),
        mixHex(variant[1], '#d7e8f4', 0.2),
        mixHex(variant[2], '#f2f8fd', 0.18),
      ]);
    }
    return uniquePalette(variant);
  }

  private resolveSignageDensity(
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

  private resolveVisualArchetype(
    input: BuildingStyleInput,
    preset: BuildingPreset,
  ): VisualArchetype {
    const area =
      Math.abs(polygonSignedArea(input.outerRing)) * 111_320 * 111_320;
    const material =
      `${input.facadeMaterial ?? ''} ${input.roofMaterial ?? ''}`.toLowerCase();

    if (preset === 'station_block' || input.usage === 'TRANSIT') {
      return 'station_like';
    }
    if (preset === 'glass_tower' && area >= 2_500) {
      return input.usage === 'COMMERCIAL' ? 'highrise_office' : 'hotel_tower';
    }
    if (preset === 'mall_block') {
      return 'mall_podium';
    }
    if (preset === 'office_midrise' || material.includes('glass')) {
      return 'commercial_midrise';
    }
    if (preset === 'small_lowrise' && input.usage === 'COMMERCIAL') {
      return 'lowrise_shop';
    }
    if (preset === 'small_lowrise') {
      return area < 500 ? 'house_compact' : 'lowrise_shop';
    }
    if (input.usage === 'MIXED') {
      return 'apartment_block';
    }
    if (input.usage === 'PUBLIC') {
      return 'station_like';
    }
    if (input.heightMeters <= 18 && area < 2200) {
      return 'lowrise_shop';
    }

    return 'apartment_block';
  }

  private resolveGeometryStrategy(
    input: BuildingStyleInput,
    preset: BuildingPreset,
    roofType: RoofType,
  ): GeometryStrategy {
    const ringArea =
      Math.abs(polygonSignedArea(input.outerRing)) * 111_320 * 111_320;
    if (input.buildingPart === 'yes' || preset === 'mall_block') {
      return 'podium_tower';
    }
    if (roofType === 'gable' || preset === 'small_lowrise') {
      return 'gable_lowrise';
    }
    if (roofType === 'stepped' || preset === 'glass_tower') {
      return 'stepped_tower';
    }
    if (ringArea >= 2_500 && input.heightMeters >= 18) {
      return 'podium_tower';
    }
    return 'simple_extrude';
  }

  private resolveFacadePreset(
    visualArchetype: VisualArchetype,
    materialClass: MaterialClass,
  ): FacadePreset {
    switch (visualArchetype) {
      case 'highrise_office':
      case 'hotel_tower':
        return 'glass_grid';
      case 'commercial_midrise':
        return materialClass === 'glass' ? 'glass_grid' : 'concrete_repetitive';
      case 'mall_podium':
        return 'mall_panel';
      case 'lowrise_shop':
        return 'retail_sign_band';
      case 'house_compact':
        return 'brick_lowrise';
      case 'station_like':
        return 'station_metal';
      default:
        return materialClass === 'brick'
          ? 'brick_lowrise'
          : 'concrete_repetitive';
    }
  }

  private resolvePodiumLevels(
    visualArchetype: VisualArchetype,
    floors: number,
  ): number {
    if (visualArchetype === 'mall_podium') {
      return Math.min(4, Math.max(2, Math.floor(floors * 0.35)));
    }
    if (
      visualArchetype === 'highrise_office' ||
      visualArchetype === 'hotel_tower'
    ) {
      return Math.min(3, Math.max(2, Math.floor(floors * 0.18)));
    }
    if (visualArchetype === 'commercial_midrise') {
      return Math.min(2, Math.max(1, Math.floor(floors * 0.2)));
    }
    return 1;
  }

  private resolveSetbackLevels(
    geometryStrategy: GeometryStrategy,
    floors: number,
  ): number {
    if (geometryStrategy === 'stepped_tower') {
      return Math.min(3, Math.max(2, Math.floor(floors / 10)));
    }
    if (geometryStrategy === 'podium_tower') {
      return 1;
    }
    return 0;
  }

  private resolveCornerChamfer(
    visualArchetype: VisualArchetype,
    input: BuildingStyleInput,
    floors: number,
  ): boolean {
    return (
      (visualArchetype === 'highrise_office' ||
        visualArchetype === 'mall_podium' ||
        visualArchetype === 'commercial_midrise') &&
      floors >= 4 &&
      input.outerRing.length >= 4
    );
  }

  private resolveRoofAccentType(
    geometryStrategy: GeometryStrategy,
    roofType: RoofType,
  ): RoofAccentType {
    if (roofType === 'gable') {
      return 'gable';
    }
    if (geometryStrategy === 'stepped_tower') {
      return 'terrace';
    }
    if (geometryStrategy === 'podium_tower') {
      return 'crown';
    }
    return 'flush';
  }

  private resolveWindowPatternDensity(
    facadePreset: FacadePreset,
    floors: number,
  ): WindowPatternDensity {
    if (facadePreset === 'glass_grid') {
      return 'dense';
    }
    if (facadePreset === 'retail_sign_band' || facadePreset === 'mall_panel') {
      return floors >= 6 ? 'medium' : 'sparse';
    }
    return floors >= 8 ? 'medium' : 'sparse';
  }

  private resolveSignBandLevels(
    visualArchetype: VisualArchetype,
    signageDensity: 'low' | 'medium' | 'high',
  ): number {
    if (signageDensity === 'high') {
      return visualArchetype === 'mall_podium' ? 3 : 2;
    }
    if (signageDensity === 'medium') {
      return 1;
    }
    return 0;
  }

  private resolvePanelPalette(
    palette: string[],
    facadePreset: FacadePreset,
  ): string[] {
    if (facadePreset === 'glass_grid') {
      return [palette[0] ?? '#7da7cf', '#d9ebf5', '#eef6fb'];
    }
    if (facadePreset === 'retail_sign_band' || facadePreset === 'mall_panel') {
      return [palette[0] ?? '#b97856', '#f0d1b7', '#ffffff'];
    }
    if (facadePreset === 'station_metal') {
      return [palette[0] ?? '#8b949d', '#d8dee3', '#f4f6f8'];
    }
    return [palette[0] ?? '#9ea4aa', palette[1] ?? '#d3d6da', '#eef1f3'];
  }
}

function resolvePaletteVariantIndex(args: {
  input: BuildingStyleInput;
  preset: BuildingPreset;
  materialClass: MaterialClass;
  poolSize: number;
}): number {
  if (args.poolSize <= 0) {
    return 0;
  }

  const usageWeight =
    args.input.usage === 'COMMERCIAL'
      ? 5
      : args.input.usage === 'TRANSIT'
        ? 4
        : args.input.usage === 'PUBLIC'
          ? 3
          : args.input.usage === 'MIXED'
            ? 2
            : 1;
  const presetWeight =
    args.preset === 'glass_tower'
      ? 7
      : args.preset === 'mall_block'
        ? 6
        : args.preset === 'station_block'
          ? 5
          : args.preset === 'office_midrise'
            ? 4
            : args.preset === 'mixed_midrise'
              ? 3
              : 2;
  const materialWeight =
    args.materialClass === 'glass'
      ? 5
      : args.materialClass === 'metal'
        ? 4
        : args.materialClass === 'concrete'
          ? 3
          : args.materialClass === 'brick'
            ? 2
            : 1;
  const heightBucket = Math.max(1, Math.round(args.input.heightMeters / 6));
  const areaBucket = Math.max(
    1,
    Math.round(
      Math.abs(polygonSignedArea(args.input.outerRing)) * 111_320 * 111_320,
    ),
  );

  return (
    (usageWeight + presetWeight + materialWeight + heightBucket + areaBucket) %
    args.poolSize
  );
}

function uniquePalette(colors: string[]): string[] {
  return [...new Set(colors)].slice(0, 3);
}

function mixHex(source: string, target: string, ratio: number): string {
  const t = clamp(ratio, 0, 1);
  const [sr, sg, sb] = hexToRgb(source);
  const [tr, tg, tb] = hexToRgb(target);
  return toHex([
    Math.round(sr + (tr - sr) * t),
    Math.round(sg + (tg - sg) * t),
    Math.round(sb + (tb - sb) * t),
  ]);
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((channel) => clamp(channel, 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
