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
): string[] {
  return [
    ...new Set(
      values
        .filter((value): value is string => Boolean(value))
        .map((value) => normalizeColor(value)),
    ),
  ].slice(0, 3);
}

function resolveContextualMaterialClass(
  style: BuildingStyleProfile,
  building: PlacePackage['buildings'][number],
  context: FacadeContext,
): {
  materialClass: MaterialClass;
  contextualUpgrade: boolean;
} {
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
            4,
          ) <= 1
            ? 'metal'
            : 'glass',
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
        stableIndex(`${building.id}:transit`, 2) === 0 ? 'metal' : 'glass',
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
          ? 'glass'
          : 'metal',
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
  if (context.districtProfile === 'TRANSIT_HUB') {
    if (materialClass === 'glass' || materialClass === 'metal') {
      return [
        ['#516d86', '#b9c6d0', '#edf3f7'],
        ['#445769', '#a9b6c1', '#e4ebf0'],
        ['#5a778f', '#cad3da', '#f0f4f7'],
        ['#74828e', '#c7cbd1', '#edf0f2'],
      ];
    }
    return [
      ['#999289', '#d6d0c7', '#eeebe4'],
      ['#8d8d88', '#d1d0cc', '#ececea'],
      ['#a39b90', '#dcd4ca', '#f0ece5'],
      ['#85888e', '#ccd0d5', '#e8edf0'],
    ];
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
      ];
    }
    if (materialClass === 'metal') {
      return [
        ['#5f6973', '#adb7c0', '#e1e6ea'],
        ['#4a5764', '#96a6b3', '#d6dee5'],
        ['#6a747d', '#bac3ca', '#e7ecef'],
        ['#72716f', '#bdbab6', '#e6e1da'],
      ];
    }
    return [
      ['#8d8780', '#cfc9c1', '#ece8e2'],
      ['#9f9488', '#d8cec3', '#f0e9df'],
      ['#7e8287', '#c3c8ce', '#e6ebef'],
      ['#b39f8e', '#ded1c3', '#f3ebe2'],
      ['#999189', '#d3ccc4', '#eeebe5'],
      ['#76736f', '#bbb8b3', '#e2dfd8'],
    ];
  }
  if (context.districtProfile === 'COMMERCIAL_STRIP') {
    if (materialClass === 'glass') {
      return [
        ['#5e8faf', '#d4e1ec', '#f4f8fb'],
        ['#6886a1', '#c7d7e5', '#eef5fa'],
        ['#7390a8', '#cad7e2', '#eef4f8'],
        ['#4b708c', '#b8cbd8', '#e9f0f4'],
      ];
    }
    if (materialClass === 'metal') {
      return [
        ['#6f7983', '#b5c0c8', '#e2e7eb'],
        ['#7e8891', '#c1c9cf', '#edf1f4'],
        ['#66727d', '#aeb8c1', '#dde4ea'],
        ['#5c6670', '#a5b0ba', '#d7dfe6'],
      ];
    }
    return [
      ['#a8a39b', '#d9d5ce', '#f2efea'],
      ['#b6a794', '#ded2c3', '#f5eee8'],
      ['#9d9a93', '#d0ccc6', '#ece8e3'],
      ['#beb2a6', '#e1d8cd', '#f6f1ea'],
      ['#97918a', '#cdc7be', '#ece7df'],
      ['#c0b2a1', '#e1d5c8', '#f4eee6'],
    ];
  }
  if (context.districtProfile === 'CIVIC_CLUSTER') {
    if (materialClass === 'glass') {
      return [
        ['#7a8ea3', '#d6dee6', '#eef4f8'],
        ['#889cad', '#d9e1e8', '#f4f7fa'],
        ['#7f8f9c', '#d0d8df', '#edf2f6'],
      ];
    }
    return [
      ['#a39d94', '#d5d0c9', '#f0ece7'],
      ['#8e939a', '#c9ced4', '#e7ebef'],
      ['#b4a697', '#ddd2c6', '#f3eee8'],
      ['#989b9f', '#d0d4d8', '#eceff1'],
      ['#c4b8aa', '#e1d8cf', '#f4f0ea'],
    ];
  }
  if (materialClass === 'glass') {
    return context.centerBias === 'core'
      ? [
          ['#6e95ba', '#c7d9ea', '#eef5fb'],
          ['#4f7ca8', '#b9d0e4', '#edf6fd'],
          ['#5e8faf', '#d4e1ec', '#f4f8fb'],
          ['#7a8ea3', '#d6dee6', '#eef4f8'],
        ]
      : [
          ['#7c9ebb', '#d5e2ec', '#f2f7fb'],
          ['#7390a8', '#cad7e2', '#eef4f8'],
          ['#889cad', '#d9e1e8', '#f4f7fa'],
          ['#6886a1', '#c7d7e5', '#eef5fa'],
        ];
  }
  if (materialClass === 'brick') {
    return [
      ['#8d4d38', '#bf7b58', '#e2c4ad'],
      ['#9b5c46', '#c98663', '#e7ccb8'],
      ['#7b4635', '#b36c4d', '#ddbea9'],
      ['#945745', '#bf8568', '#e6d2c2'],
    ];
  }
  if (materialClass === 'metal') {
    return [
      ['#6f7983', '#b5c0c8', '#e2e7eb'],
      ['#7e8891', '#c1c9cf', '#edf1f4'],
      ['#66727d', '#aeb8c1', '#dde4ea'],
      ['#77848f', '#c7d0d7', '#eef3f7'],
    ];
  }
  if (style.preset === 'mall_block' || building.usage === 'COMMERCIAL') {
    return context.centerBias === 'core'
      ? [
          ['#b79f8a', '#ddd1c4', '#f4ede6'],
          ['#9b938c', '#d3cdc6', '#f0ece8'],
          ['#c6aa93', '#e4d4c3', '#f7efe7'],
          ['#a79b8d', '#d6cec5', '#f2ede8'],
        ]
      : [
          ['#a8a39b', '#d9d5ce', '#f2efea'],
          ['#b6a794', '#ded2c3', '#f5eee8'],
          ['#9d9a93', '#d0ccc6', '#ece8e3'],
          ['#beb2a6', '#e1d8cd', '#f6f1ea'],
        ];
  }
  return [
    ['#a39d94', '#d5d0c9', '#f0ece7'],
    ['#989b9f', '#d0d4d8', '#eceff1'],
    ['#b4a697', '#ddd2c6', '#f3eee8'],
    ['#8e939a', '#c9ced4', '#e7ebef'],
    ['#c0b6ab', '#e0d8cf', '#f3f0ea'],
    ['#7f848b', '#c4cbd2', '#e4e9ed'],
  ];
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

function normalizeColor(value: string): string {
  return new BuildingStyleResolverService().normalizeColor(value);
}
