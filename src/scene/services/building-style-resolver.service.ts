import { Injectable } from '@nestjs/common';
import { polygonSignedArea } from '../../places/utils/geo.utils';
import { BuildingData, Coordinate } from '../../places/types/place.types';
import {
  BuildingPreset,
  FacadePreset,
  GeometryStrategy,
  MaterialClass,
  RoofAccentType,
  RoofType,
  VisualArchetype,
  WindowPatternDensity,
} from '../types/scene.types';

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

@Injectable()
export class BuildingStyleResolverService {
  resolveBuildingStyle(input: BuildingStyleInput): BuildingStyleProfile {
    const preset = this.classifyBuildingPreset(input);
    const materialClass = this.resolveMaterialClass(input, preset);
    const roofType = this.resolveRoofType(input, preset);
    const palette = this.resolvePalette(input, materialClass, preset);
    const visualArchetype = this.resolveVisualArchetype(input, preset);
    const geometryStrategy = this.resolveGeometryStrategy(input, preset, roofType);
    const facadePreset = this.resolveFacadePreset(visualArchetype, materialClass);
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
    const cornerChamfer = this.resolveCornerChamfer(visualArchetype, input, floors);
    const roofAccentType = this.resolveRoofAccentType(geometryStrategy, roofType);
    const windowPatternDensity = this.resolveWindowPatternDensity(
      facadePreset,
      floors,
    );
    const signBandLevels = this.resolveSignBandLevels(visualArchetype, signageDensity);
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
        (preset === 'glass_tower' || preset === 'mall_block' || preset === 'station_block'),
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

  resolveRoofType(
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
    const area = Math.abs(polygonSignedArea(input.outerRing)) * 111_320 * 111_320;
    const material = `${input.facadeMaterial ?? ''} ${input.roofMaterial ?? ''}`.toLowerCase();

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

    return 'commercial_midrise';
  }

  private resolveGeometryStrategy(
    input: BuildingStyleInput,
    preset: BuildingPreset,
    roofType: RoofType,
  ): GeometryStrategy {
    const ringArea = Math.abs(polygonSignedArea(input.outerRing)) * 111_320 * 111_320;
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
        return materialClass === 'brick' ? 'brick_lowrise' : 'concrete_repetitive';
    }
  }

  private resolvePodiumLevels(
    visualArchetype: VisualArchetype,
    floors: number,
  ): number {
    if (visualArchetype === 'mall_podium') {
      return Math.min(4, Math.max(2, Math.floor(floors * 0.35)));
    }
    if (visualArchetype === 'highrise_office' || visualArchetype === 'hotel_tower') {
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
