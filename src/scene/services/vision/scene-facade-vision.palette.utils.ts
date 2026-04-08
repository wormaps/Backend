import type { PlacePackage } from '../../../places/types/place.types';
import type { MaterialClass } from '../../types/scene.types';
import {
  BuildingStyleProfile,
  BuildingStyleResolverService,
} from './building-style-resolver.service';
import type { FacadeContext } from './scene-facade-vision.context.utils';

export function hasExplicitBuildingColor(
  building: PlacePackage['buildings'][number],
): boolean {
  return Boolean(building.facadeColor || building.roofColor);
}

export function inferBuildingPalette(
  buildingId: string,
  building: PlacePackage['buildings'][number],
  style: BuildingStyleProfile,
  context: FacadeContext,
): {
  materialClass: MaterialClass;
  palette: string[];
  shellPalette: string[];
  panelPalette: string[];
  contextualUpgrade: boolean;
} {
  const { materialClass, contextualUpgrade } = resolveContextualMaterialClass(
    style,
    building,
    context,
  );
  const family = resolvePaletteFamily(materialClass, style, building, context);
  const variant = stableIndex(
    `${buildingId}:${context.districtProfile}:${context.centerBias}`,
    family.length,
  );
  const palette = family[variant] ?? family[0];

  return {
    materialClass,
    palette,
    shellPalette: resolveShellPalette(palette, materialClass, context),
    panelPalette: resolvePanelPalette(
      materialClass,
      style,
      palette,
      variant,
      context,
    ),
    contextualUpgrade,
  };
}

export function uniquePalette(
  values: Array<string | null | undefined>,
  limit = 3,
): string[] {
  return [
    ...new Set(
      values
        .filter((value): value is string => Boolean(value))
        .map((value) => normalizeColor(value)),
    ),
  ].slice(0, Math.max(1, limit));
}

export function resolveFacadeColorChannels(input: {
  palette: string[];
  roofColor?: string | null;
  districtProfile?: FacadeContext['districtProfile'];
}): {
  mainColor: string;
  accentColor: string;
  trimColor: string;
  roofColor: string;
} {
  const base = normalizeColor(input.palette[0] ?? '#8e939a');
  const districtAccent = resolveDistrictAccent(
    input.districtProfile ?? 'RESIDENTIAL_EDGE',
    base,
  );
  const accentSeed = normalizeColor(
    isNearNeutral(base)
      ? districtAccent
      : (input.palette[1] ?? darkenHex(base, 0.82)),
  );
  const accent = ensureDistinctColor(accentSeed, base, () => districtAccent);
  const trim = ensureDistinctColor(
    normalizeColor(
      input.palette[2] ?? desaturateHex(darkenHex(base, 0.9), 0.08),
    ),
    base,
    () => desaturateHex(darkenHex(districtAccent, 0.86), 0.18),
  );
  const roof = ensureDistinctColor(
    normalizeColor(input.roofColor ?? darkenHex(base, 0.84)),
    base,
    () => darkenHex(base, 0.76),
  );
  return {
    mainColor: base,
    accentColor: accent,
    trimColor: trim,
    roofColor: roof,
  };
}

function resolveContextualMaterialClass(
  style: BuildingStyleProfile,
  building: PlacePackage['buildings'][number],
  context: FacadeContext,
): {
  materialClass: MaterialClass;
  contextualUpgrade: boolean;
} {
  const hasExplicitGlassMaterial = [
    building.facadeMaterial,
    building.roofMaterial,
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes('glass'));

  const shouldReduceInferredCommercialGlass =
    style.materialClass === 'glass' &&
    !hasExplicitGlassMaterial &&
    style.preset !== 'glass_tower' &&
    (building.usage === 'COMMERCIAL' || building.usage === 'MIXED') &&
    (context.districtProfile === 'NEON_CORE' ||
      context.districtProfile === 'COMMERCIAL_STRIP' ||
      context.districtProfile === 'TRANSIT_HUB');

  if (shouldReduceInferredCommercialGlass) {
    const selector = stableIndex(
      `${building.id}:inferred-commercial-glass:${context.districtProfile}`,
      8,
    );
    return {
      materialClass:
        selector <= 4 ? 'metal' : selector <= 6 ? 'concrete' : 'glass',
      contextualUpgrade: true,
    };
  }

  if (style.materialClass !== 'mixed') {
    if (
      style.materialClass === 'concrete' &&
      (building.usage === 'COMMERCIAL' || building.usage === 'MIXED') &&
      (context.districtProfile === 'NEON_CORE' ||
        context.districtProfile === 'COMMERCIAL_STRIP') &&
      (building.heightMeters >= 14 ||
        context.crossingCount >= 2 ||
        context.commercialNeighborCount >= 2 ||
        context.poiNeighborCount >= 2)
    ) {
      return {
        materialClass:
          stableIndex(
            `${building.id}:commercial-upgrade:${context.districtProfile}`,
            6,
          ) <= 3
            ? 'metal'
            : stableIndex(`${building.id}:commercial-upgrade-fallback`, 3) === 0
              ? 'glass'
              : 'concrete',
        contextualUpgrade: true,
      };
    }
    return { materialClass: style.materialClass, contextualUpgrade: false };
  }
  if (style.preset === 'small_lowrise') {
    return { materialClass: 'brick', contextualUpgrade: false };
  }
  if (style.preset === 'station_block') {
    return { materialClass: 'metal', contextualUpgrade: false };
  }
  if (
    building.usage === 'TRANSIT' ||
    context.districtProfile === 'TRANSIT_HUB'
  ) {
    return {
      materialClass:
        stableIndex(`${building.id}:transit`, 6) <= 3
          ? 'metal'
          : stableIndex(`${building.id}:transit-fallback`, 3) === 0
            ? 'glass'
            : 'concrete',
      contextualUpgrade: false,
    };
  }
  if (
    (building.usage === 'COMMERCIAL' || building.usage === 'MIXED') &&
    (context.districtProfile === 'NEON_CORE' ||
      context.districtProfile === 'COMMERCIAL_STRIP')
  ) {
    return {
      materialClass:
        building.heightMeters >= 20 ||
        context.tallNeighborCount >= 2 ||
        context.crossingCount >= 2 ||
        context.poiNeighborCount >= 3
          ? stableIndex(`${building.id}:commercial-heavy`, 5) === 0
            ? 'glass'
            : 'metal'
          : stableIndex(`${building.id}:commercial-light`, 4) === 0
            ? 'glass'
            : 'concrete',
      contextualUpgrade: false,
    };
  }
  if (
    building.usage === 'PUBLIC' ||
    context.districtProfile === 'CIVIC_CLUSTER'
  ) {
    return { materialClass: 'concrete', contextualUpgrade: false };
  }
  if (building.usage === 'MIXED') {
    return { materialClass: 'concrete', contextualUpgrade: false };
  }
  return { materialClass: 'concrete', contextualUpgrade: false };
}

function resolvePaletteFamily(
  materialClass: MaterialClass,
  style: BuildingStyleProfile,
  building: PlacePackage['buildings'][number],
  context: FacadeContext,
): string[][] {
  const archetype = style.visualArchetype;

  const archetypeBand = resolveArchetypePaletteBand(
    archetype,
    materialClass,
    context,
  );
  if (archetypeBand) {
    return archetypeBand.map((palette) =>
      applyDistrictBiasWithinBand(palette, context),
    );
  }

  if (context.districtProfile === 'TRANSIT_HUB') {
    if (materialClass === 'glass' || materialClass === 'metal') {
      return [
        ['#516d86', '#b9c6d0', '#edf3f7'],
        ['#445769', '#a9b6c1', '#e4ebf0'],
        ['#5a778f', '#cad3da', '#f0f4f7'],
        ['#74828e', '#c7cbd1', '#edf0f2'],
      ].map((palette) => applyDistrictBiasWithinBand(palette, context));
    }
    return [
      ['#999289', '#d6d0c7', '#eeebe4'],
      ['#8d8d88', '#d1d0cc', '#ececea'],
      ['#a39b90', '#dcd4ca', '#f0ece5'],
      ['#85888e', '#ccd0d5', '#e8edf0'],
    ].map((palette) => applyDistrictBiasWithinBand(palette, context));
  }
  if (context.districtProfile === 'NEON_CORE') {
    if (materialClass === 'glass') {
      return [
        ['#46637c', '#9cb7c8', '#e3edf3'],
        ['#35546f', '#8eadc1', '#dce8ef'],
        ['#587b95', '#bfd2df', '#ecf3f7'],
        ['#6f8698', '#c6d1d9', '#eef3f5'],
        ['#2f475f', '#8fa5b5', '#dbe4eb'],
        ['#657f94', '#b7c9d6', '#e7eff4'],
      ].map((palette) => applyDistrictBiasWithinBand(palette, context));
    }
    if (materialClass === 'metal') {
      return [
        ['#5f6973', '#adb7c0', '#e1e6ea'],
        ['#4a5764', '#96a6b3', '#d6dee5'],
        ['#6a747d', '#bac3ca', '#e7ecef'],
        ['#72716f', '#bdbab6', '#e6e1da'],
      ].map((palette) => applyDistrictBiasWithinBand(palette, context));
    }
    return [
      ['#8d8780', '#cfc9c1', '#ece8e2'],
      ['#9f9488', '#d8cec3', '#f0e9df'],
      ['#7e8287', '#c3c8ce', '#e6ebef'],
      ['#b39f8e', '#ded1c3', '#f3ebe2'],
      ['#999189', '#d3ccc4', '#eeebe5'],
      ['#76736f', '#bbb8b3', '#e2dfd8'],
    ].map((palette) => applyDistrictBiasWithinBand(palette, context));
  }
  if (context.districtProfile === 'COMMERCIAL_STRIP') {
    if (materialClass === 'glass') {
      return [
        ['#5e8faf', '#d4e1ec', '#f4f8fb'],
        ['#6886a1', '#c7d7e5', '#eef5fa'],
        ['#7390a8', '#cad7e2', '#eef4f8'],
        ['#4b708c', '#b8cbd8', '#e9f0f4'],
      ].map((palette) => applyDistrictBiasWithinBand(palette, context));
    }
    if (materialClass === 'metal') {
      return [
        ['#6f7983', '#b5c0c8', '#e2e7eb'],
        ['#7e8891', '#c1c9cf', '#edf1f4'],
        ['#66727d', '#aeb8c1', '#dde4ea'],
        ['#5c6670', '#a5b0ba', '#d7dfe6'],
      ].map((palette) => applyDistrictBiasWithinBand(palette, context));
    }
    return [
      ['#a8a39b', '#d9d5ce', '#f2efea'],
      ['#b6a794', '#ded2c3', '#f5eee8'],
      ['#9d9a93', '#d0ccc6', '#ece8e3'],
      ['#beb2a6', '#e1d8cd', '#f6f1ea'],
      ['#97918a', '#cdc7be', '#ece7df'],
      ['#c0b2a1', '#e1d5c8', '#f4eee6'],
    ].map((palette) => applyDistrictBiasWithinBand(palette, context));
  }
  if (context.districtProfile === 'CIVIC_CLUSTER') {
    if (materialClass === 'glass') {
      return [
        ['#7a8ea3', '#d6dee6', '#eef4f8'],
        ['#889cad', '#d9e1e8', '#f4f7fa'],
        ['#7f8f9c', '#d0d8df', '#edf2f6'],
      ].map((palette) => applyDistrictBiasWithinBand(palette, context));
    }
    return [
      ['#a39d94', '#d5d0c9', '#f0ece7'],
      ['#8e939a', '#c9ced4', '#e7ebef'],
      ['#b4a697', '#ddd2c6', '#f3eee8'],
      ['#989b9f', '#d0d4d8', '#eceff1'],
      ['#c4b8aa', '#e1d8cf', '#f4f0ea'],
    ].map((palette) => applyDistrictBiasWithinBand(palette, context));
  }
  if (materialClass === 'glass') {
    return context.centerBias === 'core'
      ? [
          ['#6e95ba', '#c7d9ea', '#eef5fb'],
          ['#4f7ca8', '#b9d0e4', '#edf6fd'],
          ['#5e8faf', '#d4e1ec', '#f4f8fb'],
          ['#7a8ea3', '#d6dee6', '#eef4f8'],
        ].map((palette) => applyDistrictBiasWithinBand(palette, context))
      : [
          ['#7c9ebb', '#d5e2ec', '#f2f7fb'],
          ['#7390a8', '#cad7e2', '#eef4f8'],
          ['#889cad', '#d9e1e8', '#f4f7fa'],
          ['#6886a1', '#c7d7e5', '#eef5fa'],
        ].map((palette) => applyDistrictBiasWithinBand(palette, context));
  }
  if (materialClass === 'brick') {
    return [
      ['#8d4d38', '#bf7b58', '#e2c4ad'],
      ['#9b5c46', '#c98663', '#e7ccb8'],
      ['#7b4635', '#b36c4d', '#ddbea9'],
      ['#945745', '#bf8568', '#e6d2c2'],
    ].map((palette) => applyDistrictBiasWithinBand(palette, context));
  }
  if (materialClass === 'metal') {
    return [
      ['#6f7983', '#b5c0c8', '#e2e7eb'],
      ['#7e8891', '#c1c9cf', '#edf1f4'],
      ['#66727d', '#aeb8c1', '#dde4ea'],
      ['#77848f', '#c7d0d7', '#eef3f7'],
    ].map((palette) => applyDistrictBiasWithinBand(palette, context));
  }
  if (style.preset === 'mall_block' || building.usage === 'COMMERCIAL') {
    return context.centerBias === 'core'
      ? [
          ['#b79f8a', '#ddd1c4', '#f4ede6'],
          ['#9b938c', '#d3cdc6', '#f0ece8'],
          ['#c6aa93', '#e4d4c3', '#f7efe7'],
          ['#a79b8d', '#d6cec5', '#f2ede8'],
        ].map((palette) => applyDistrictBiasWithinBand(palette, context))
      : [
          ['#a8a39b', '#d9d5ce', '#f2efea'],
          ['#b6a794', '#ded2c3', '#f5eee8'],
          ['#9d9a93', '#d0ccc6', '#ece8e3'],
          ['#beb2a6', '#e1d8cd', '#f6f1ea'],
        ].map((palette) => applyDistrictBiasWithinBand(palette, context));
  }
  return [
    ['#a39d94', '#d5d0c9', '#f0ece7'],
    ['#989b9f', '#d0d4d8', '#eceff1'],
    ['#b4a697', '#ddd2c6', '#f3eee8'],
    ['#8e939a', '#c9ced4', '#e7ebef'],
    ['#c0b6ab', '#e0d8cf', '#f3f0ea'],
    ['#7f848b', '#c4cbd2', '#e4e9ed'],
  ].map((palette) => applyDistrictBiasWithinBand(palette, context));
}

function resolveArchetypePaletteBand(
  archetype: BuildingStyleProfile['visualArchetype'],
  materialClass: MaterialClass,
  context: FacadeContext,
): string[][] | null {
  if (archetype === 'apartment_block' || archetype === 'house_compact') {
    return [
      ['#c8beb1', '#e5ddd3', '#f4efe9'],
      ['#bdb8b2', '#ddd9d3', '#eeece8'],
      ['#b7c1cc', '#dde4eb', '#eef2f6'],
      ['#d4cdc3', '#e8e1d7', '#f5f1eb'],
    ];
  }
  if (archetype === 'highrise_office' || archetype === 'commercial_midrise') {
    return [
      ['#6f859c', '#b7c6d3', '#e6edf3'],
      ['#5d7388', '#aab9c6', '#dfe7ee'],
      ['#8794a1', '#c6cdd3', '#edf0f3'],
      ['#4f6478', '#9fb0be', '#d8e3ec'],
    ];
  }
  if (archetype === 'mall_podium' || archetype === 'lowrise_shop') {
    return context.districtProfile === 'NEON_CORE'
      ? [
          ['#3e4958', '#f4eee8', '#ff7a59'],
          ['#2f3b4a', '#f2f6fb', '#3ec1d3'],
          ['#4b4250', '#f8f2e8', '#ffb703'],
          ['#404654', '#f4f1ec', '#00d084'],
        ]
      : [
          ['#505a67', '#ece6de', '#d87b59'],
          ['#5b6773', '#f0ebe3', '#c86b5d'],
          ['#4c5965', '#f2eee9', '#d29a4a'],
          ['#56606b', '#ece8e0', '#4f9bb7'],
        ];
  }
  if (archetype === 'hotel_tower') {
    return [
      ['#6b7f90', '#d2dbe2', '#f0f4f7'],
      ['#74879a', '#d8dde2', '#f3f6f8'],
      ['#5f7386', '#c7d2dc', '#ebf0f4'],
      ['#8b9198', '#d7d9dc', '#f0f1f2'],
    ];
  }
  if (
    archetype === 'station_like' ||
    materialClass === 'metal' ||
    context.districtProfile === 'TRANSIT_HUB'
  ) {
    return [
      ['#5f666e', '#a9b0b7', '#dfe3e7'],
      ['#6a6761', '#b3aaa0', '#e1d9cf'],
      ['#4f5963', '#98a3ad', '#d2dbe3'],
      ['#6f726f', '#b9bbb8', '#e6e7e5'],
    ];
  }
  return null;
}

function applyDistrictBiasWithinBand(
  palette: string[],
  context: FacadeContext,
): string[] {
  const { satDelta, lumDelta } = resolveDistrictBias(context.districtProfile);
  return palette.map((hex, index) => {
    const attenuation = index === 0 ? 1 : index === 1 ? 0.85 : 0.72;
    return adjustHexSaturationLuminance(
      hex,
      satDelta * attenuation,
      lumDelta * attenuation,
    );
  });
}

function resolveDistrictBias(profile: FacadeContext['districtProfile']): {
  satDelta: number;
  lumDelta: number;
} {
  // Oracle guardrail: keep this small (≈8%), cap at 12%
  switch (profile) {
    case 'NEON_CORE':
      return { satDelta: 0.11, lumDelta: -0.032 };
    case 'COMMERCIAL_STRIP':
      return { satDelta: 0.075, lumDelta: 0.012 };
    case 'TRANSIT_HUB':
      return { satDelta: -0.03, lumDelta: 0.01 };
    case 'CIVIC_CLUSTER':
      return { satDelta: -0.02, lumDelta: 0.018 };
    case 'RESIDENTIAL_EDGE':
    default:
      return { satDelta: 0.02, lumDelta: 0.012 };
  }
}

function adjustHexSaturationLuminance(
  hex: string,
  saturationDelta: number,
  luminanceDelta: number,
): string {
  const [r, g, b] = hexToRgb(hex);
  const gray = r * 0.299 + g * 0.587 + b * 0.114;
  const sat = clamp01(1 + clampRange(saturationDelta, -0.12, 0.12));

  const sr = clamp01(gray + (r - gray) * sat);
  const sg = clamp01(gray + (g - gray) * sat);
  const sb = clamp01(gray + (b - gray) * sat);

  const lumFactor = 1 + clampRange(luminanceDelta, -0.12, 0.12);
  return toHex([sr * lumFactor, sg * lumFactor, sb * lumFactor]);
}

function toHex([r, g, b]: [number, number, number]): string {
  const toChannel = (value: number): string =>
    Math.round(clamp01(value) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toChannel(r)}${toChannel(g)}${toChannel(b)}`;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolvePanelPalette(
  materialClass: MaterialClass,
  style: BuildingStyleProfile,
  palette: string[],
  variant: number,
  context: FacadeContext,
): string[] {
  if (style.facadePreset === 'glass_grid') {
    const variants = [
      [darkenHex(palette[0] ?? '#6e95ba', 0.78), '#d7e6f2', '#f5f9fc'],
      [darkenHex(palette[0] ?? '#4f7ca8', 0.76), '#d1e0ec', '#f1f6fb'],
      [darkenHex(palette[0] ?? '#5e8faf', 0.74), '#dde8f1', '#f6f9fb'],
      [darkenHex(palette[0] ?? '#7a8ea3', 0.72), '#d9e1e8', '#f3f7fa'],
    ];
    return variants[variant] ?? variants[0];
  }
  if (
    style.facadePreset === 'retail_sign_band' ||
    style.facadePreset === 'mall_panel'
  ) {
    if (context.districtProfile === 'NEON_CORE') {
      const variants = [
        ['#ff3b30', '#ffd60a', '#fff4d6'],
        ['#00c2ff', '#ff2d55', '#f8fbff'],
        ['#7c4dff', '#00e5ff', '#f7f4ff'],
        ['#00d084', '#ffc857', '#f4fff9'],
        ['#ff6f61', '#3ec1d3', '#fefefe'],
        ['#ffb703', '#fb8500', '#fff3db'],
      ];
      return variants[variant] ?? variants[0];
    }
    const variants = [
      ['#f44336', '#ffd166', '#fff8e7'],
      ['#ff6f61', '#3ec1d3', '#fefefe'],
      ['#ffb703', '#fb8500', '#fff3db'],
      ['#00bcd4', '#ff4d6d', '#fff7f0'],
    ];
    return variants[variant] ?? variants[0];
  }
  if (materialClass === 'brick') {
    return [palette[0] ?? '#8d4d38', '#d9c1ae', '#f0e6dd'];
  }
  if (
    context.districtProfile === 'NEON_CORE' ||
    context.districtProfile === 'COMMERCIAL_STRIP'
  ) {
    return [
      darkenHex(palette[0] ?? '#8e939a', 0.7),
      palette[1] ?? '#d0d4d8',
      '#e9eef2',
    ];
  }
  return [
    darkenHex(palette[0] ?? '#8e939a', 0.82),
    palette[1] ?? '#d0d4d8',
    '#eef2f5',
  ];
}

function resolveShellPalette(
  palette: string[],
  materialClass: MaterialClass,
  context: FacadeContext,
): string[] {
  const base = palette[0] ?? '#8e939a';
  const secondary = palette[1] ?? '#d0d4d8';
  if (context.districtProfile === 'NEON_CORE' && materialClass === 'glass') {
    return [darkenHex(base, 0.82), secondary];
  }
  if (materialClass === 'metal') {
    return [darkenHex(base, 0.9), secondary];
  }
  if (materialClass === 'brick') {
    return [darkenHex(base, 0.92), secondary];
  }
  return [base, secondary];
}

function stableIndex(seed: string, modulo: number): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
}

function darkenHex(hex: string, factor: number): string {
  const normalized = hex.replace('#', '');
  const red = Math.round(parseInt(normalized.slice(0, 2), 16) * factor);
  const green = Math.round(parseInt(normalized.slice(2, 4), 16) * factor);
  const blue = Math.round(parseInt(normalized.slice(4, 6), 16) * factor);
  return `#${[red, green, blue]
    .map((value) =>
      Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0'),
    )
    .join('')}`;
}

function desaturateHex(hex: string, amount: number): string {
  const normalized = hex.replace('#', '');
  const red = parseInt(normalized.slice(0, 2), 16) / 255;
  const green = parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = parseInt(normalized.slice(4, 6), 16) / 255;
  const gray = red * 0.299 + green * 0.587 + blue * 0.114;
  const mix = Math.max(0, Math.min(1, amount));
  const toChannel = (value: number): string =>
    Math.round((value * (1 - mix) + gray * mix) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toChannel(red)}${toChannel(green)}${toChannel(blue)}`;
}

function ensureDistinctColor(
  candidate: string,
  from: string,
  fallback: () => string,
): string {
  return colorDistance(candidate, from) < 0.08
    ? normalizeColor(fallback())
    : candidate;
}

function colorDistance(a: string, b: string): number {
  const aRgb = hexToRgb(a);
  const bRgb = hexToRgb(b);
  const dr = aRgb[0] - bRgb[0];
  const dg = aRgb[1] - bRgb[1];
  const db = aRgb[2] - bRgb[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const red = parseInt(normalized.slice(0, 2), 16) / 255;
  const green = parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = parseInt(normalized.slice(4, 6), 16) / 255;
  return [red, green, blue];
}

function normalizeColor(value: string): string {
  return new BuildingStyleResolverService().normalizeColor(value);
}

function isNearNeutral(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min < 0.13;
}

function resolveDistrictAccent(
  profile: FacadeContext['districtProfile'],
  base: string,
): string {
  const variants =
    profile === 'NEON_CORE'
      ? ['#ff5d5d', '#ff7a59', '#ffb703', '#7c4dff']
      : profile === 'COMMERCIAL_STRIP'
        ? ['#3eaed8', '#4f9bb7', '#00bcd4', '#5aa9e6']
        : profile === 'TRANSIT_HUB'
          ? ['#4f7ca8', '#5f7f9f', '#6886a1', '#5e8faf']
          : profile === 'CIVIC_CLUSTER'
            ? ['#5f7f9f', '#74879a', '#6b7f90', '#7a8ea3']
            : ['#5c8b61', '#6a8f73', '#4f9bb7', '#8a7f6b'];
  const accent =
    variants[stableIndex(`${profile}:${base}`, variants.length)] ?? '#5c8b61';
  return ensureDistinctColor(accent, base, () => darkenHex(accent, 0.88));
}
