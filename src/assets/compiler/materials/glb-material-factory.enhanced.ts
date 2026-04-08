import {
  createSceneMaterials,
  FacadeLayerMaterialProfile,
  MaterialTuningOptions,
} from './glb-material-factory.scene';

export type FacadeMaterialType =
  | 'brick'
  | 'concrete'
  | 'glass'
  | 'metal'
  | 'modern_glass';

export interface FacadeMaterialParams {
  baseColor: [number, number, number];
  metallicFactor: number;
  roughnessFactor: number;
  emissiveFactor?: [number, number, number];
}

export function createFacadeMaterial(
  doc: any,
  type: FacadeMaterialType,
  variant: 'light' | 'mid' | 'dark' = 'mid',
): any {
  const params = getFacadeMaterialParams(type, variant);
  return doc
    .createMaterial(`facade-${type}-${variant}`)
    .setBaseColorFactor([...params.baseColor, 1])
    .setMetallicFactor(params.metallicFactor)
    .setRoughnessFactor(params.roughnessFactor)
    .setEmissiveFactor(params.emissiveFactor ?? [0, 0, 0]);
}

function getFacadeMaterialParams(
  type: FacadeMaterialType,
  variant: 'light' | 'mid' | 'dark',
): FacadeMaterialParams {
  switch (type) {
    case 'brick':
      return getBrickParams(variant);
    case 'concrete':
      return getConcreteParams(variant);
    case 'glass':
      return getGlassParams(variant);
    case 'metal':
      return getMetalParams(variant);
    case 'modern_glass':
      return getModernGlassParams(variant);
    default:
      return getConcreteParams(variant);
  }
}

function getBrickParams(
  variant: 'light' | 'mid' | 'dark',
): FacadeMaterialParams {
  const colors = {
    light: [0.72, 0.52, 0.42] as [number, number, number],
    mid: [0.65, 0.42, 0.32] as [number, number, number],
    dark: [0.48, 0.28, 0.22] as [number, number, number],
  };
  return {
    baseColor: colors[variant],
    metallicFactor: 0,
    roughnessFactor: 0.92,
  };
}

function getConcreteParams(
  variant: 'light' | 'mid' | 'dark',
): FacadeMaterialParams {
  const colors = {
    light: [0.78, 0.76, 0.74] as [number, number, number],
    mid: [0.62, 0.6, 0.58] as [number, number, number],
    dark: [0.42, 0.4, 0.38] as [number, number, number],
  };
  return {
    baseColor: colors[variant],
    metallicFactor: 0,
    roughnessFactor: 0.88,
  };
}

function getGlassParams(
  variant: 'light' | 'mid' | 'dark',
): FacadeMaterialParams {
  const colors = {
    light: [0.68, 0.78, 0.88] as [number, number, number],
    mid: [0.52, 0.62, 0.72] as [number, number, number],
    dark: [0.28, 0.38, 0.48] as [number, number, number],
  };
  return {
    baseColor: colors[variant],
    metallicFactor: 0.15,
    roughnessFactor: 0.18,
    emissiveFactor: [0.02, 0.04, 0.06],
  };
}

function getMetalParams(
  variant: 'light' | 'mid' | 'dark',
): FacadeMaterialParams {
  const colors = {
    light: [0.72, 0.74, 0.76] as [number, number, number],
    mid: [0.58, 0.6, 0.62] as [number, number, number],
    dark: [0.38, 0.4, 0.42] as [number, number, number],
  };
  return {
    baseColor: colors[variant],
    metallicFactor: 0.45,
    roughnessFactor: 0.42,
  };
}

function getModernGlassParams(
  variant: 'light' | 'mid' | 'dark',
): FacadeMaterialParams {
  const colors = {
    light: [0.58, 0.72, 0.82] as [number, number, number],
    mid: [0.42, 0.56, 0.68] as [number, number, number],
    dark: [0.22, 0.34, 0.46] as [number, number, number],
  };
  return {
    baseColor: colors[variant],
    metallicFactor: 0.22,
    roughnessFactor: 0.12,
    emissiveFactor: [0.04, 0.08, 0.12],
  };
}

export type WindowGlassType =
  | 'clear'
  | 'tinted'
  | 'reflective'
  | 'curtain_wall';

export function createWindowGlassMaterial(
  doc: any,
  type: WindowGlassType,
): any {
  const params = getWindowGlassParams(type);
  return doc
    .createMaterial(`window-glass-${type}`)
    .setBaseColorFactor([...params.baseColor, params.alpha ?? 1])
    .setMetallicFactor(params.metallicFactor)
    .setRoughnessFactor(params.roughnessFactor)
    .setEmissiveFactor(params.emissiveFactor ?? [0, 0, 0]);
}

interface WindowGlassParams {
  baseColor: [number, number, number];
  alpha?: number;
  metallicFactor: number;
  roughnessFactor: number;
  emissiveFactor?: [number, number, number];
}

function getWindowGlassParams(type: WindowGlassType): WindowGlassParams {
  switch (type) {
    case 'clear':
      return {
        baseColor: [0.72, 0.82, 0.92],
        alpha: 0.75,
        metallicFactor: 0.08,
        roughnessFactor: 0.14,
        emissiveFactor: [0.03, 0.05, 0.08],
      };
    case 'tinted':
      return {
        baseColor: [0.32, 0.42, 0.52],
        alpha: 0.82,
        metallicFactor: 0.12,
        roughnessFactor: 0.16,
        emissiveFactor: [0.02, 0.03, 0.05],
      };
    case 'reflective':
      return {
        baseColor: [0.48, 0.58, 0.68],
        alpha: 0.88,
        metallicFactor: 0.35,
        roughnessFactor: 0.08,
        emissiveFactor: [0.05, 0.08, 0.12],
      };
    case 'curtain_wall':
      return {
        baseColor: [0.38, 0.52, 0.64],
        alpha: 0.85,
        metallicFactor: 0.28,
        roughnessFactor: 0.1,
        emissiveFactor: [0.06, 0.1, 0.14],
      };
    default:
      return {
        baseColor: [0.72, 0.82, 0.92],
        alpha: 0.75,
        metallicFactor: 0.08,
        roughnessFactor: 0.14,
      };
  }
}

export type NeonColorTone =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'cyan'
  | 'blue'
  | 'purple'
  | 'white'
  | 'pink';

export function createNeonSignMaterial(
  doc: any,
  tone: NeonColorTone,
  intensity: 'subtle' | 'normal' | 'bright' = 'normal',
): any {
  const params = getNeonSignParams(tone, intensity);
  return doc
    .createMaterial(`neon-sign-${tone}-${intensity}`)
    .setBaseColorFactor([...params.baseColor, 1])
    .setEmissiveFactor(params.emissiveFactor)
    .setMetallicFactor(0)
    .setRoughnessFactor(0.65);
}

interface NeonSignParams {
  baseColor: [number, number, number];
  emissiveFactor: [number, number, number];
}

function getNeonSignParams(
  tone: NeonColorTone,
  intensity: 'subtle' | 'normal' | 'bright',
): NeonSignParams {
  const intensityMultiplier =
    intensity === 'subtle' ? 0.52 : intensity === 'bright' ? 1.15 : 0.92;

  const colors: Record<
    NeonColorTone,
    { base: [number, number, number]; emissive: [number, number, number] }
  > = {
    red: { base: [0.92, 0.18, 0.12], emissive: [0.85, 0.12, 0.08] },
    orange: { base: [0.95, 0.52, 0.12], emissive: [0.88, 0.38, 0.06] },
    yellow: { base: [0.96, 0.88, 0.22], emissive: [0.92, 0.82, 0.15] },
    green: { base: [0.22, 0.88, 0.32], emissive: [0.15, 0.82, 0.22] },
    cyan: { base: [0.18, 0.82, 0.88], emissive: [0.12, 0.75, 0.82] },
    blue: { base: [0.22, 0.42, 0.92], emissive: [0.15, 0.32, 0.85] },
    purple: { base: [0.68, 0.28, 0.88], emissive: [0.58, 0.18, 0.82] },
    white: { base: [0.96, 0.96, 0.98], emissive: [0.88, 0.88, 0.92] },
    pink: { base: [0.92, 0.42, 0.68], emissive: [0.85, 0.32, 0.58] },
  };

  const color = colors[tone];
  return {
    baseColor: color.base,
    emissiveFactor: [
      Math.min(1, color.emissive[0] * intensityMultiplier),
      Math.min(1, color.emissive[1] * intensityMultiplier),
      Math.min(1, color.emissive[2] * intensityMultiplier),
    ],
  };
}

export type BuildingLightType =
  | 'warm_interior'
  | 'cool_interior'
  | 'accent_spot'
  | 'flood_light'
  | 'window_glow';

export function createBuildingLightMaterial(
  doc: any,
  type: BuildingLightType,
): any {
  const params = getBuildingLightParams(type);
  return doc
    .createMaterial(`building-light-${type}`)
    .setBaseColorFactor([...params.baseColor, 1])
    .setEmissiveFactor(params.emissiveFactor)
    .setMetallicFactor(0)
    .setRoughnessFactor(0.72);
}

interface BuildingLightParams {
  baseColor: [number, number, number];
  emissiveFactor: [number, number, number];
}

function getBuildingLightParams(type: BuildingLightType): BuildingLightParams {
  switch (type) {
    case 'warm_interior':
      return {
        baseColor: [0.96, 0.82, 0.58],
        emissiveFactor: [0.86, 0.62, 0.34],
      };
    case 'cool_interior':
      return {
        baseColor: [0.72, 0.82, 0.92],
        emissiveFactor: [0.62, 0.72, 0.84],
      };
    case 'accent_spot':
      return {
        baseColor: [0.98, 0.92, 0.78],
        emissiveFactor: [0.96, 0.82, 0.55],
      };
    case 'flood_light':
      return {
        baseColor: [0.98, 0.96, 0.94],
        emissiveFactor: [1, 0.96, 0.9],
      };
    case 'window_glow':
      return {
        baseColor: [0.88, 0.78, 0.62],
        emissiveFactor: [0.74, 0.56, 0.36],
      };
    default:
      return {
        baseColor: [0.88, 0.78, 0.62],
        emissiveFactor: [0.74, 0.56, 0.36],
      };
  }
}

export function createEnhancedSceneMaterials(
  doc: any,
  tuningOptions: MaterialTuningOptions = {},
  facadeProfile: FacadeLayerMaterialProfile = {},
) {
  const baseMaterials = createSceneMaterials(doc, tuningOptions);

  const facadeMaterialFamily =
    facadeProfile.facadeFamily ?? resolveFacadeMaterialFamily(facadeProfile);
  const facadeVariant = facadeProfile.facadeVariant ?? 'mid';
  const windowType = facadeProfile.windowType ?? 'reflective';
  const entranceSurface = facadeProfile.entranceSurface ?? 'concrete';
  const roofEquipmentSurface = facadeProfile.roofEquipmentSurface ?? 'metal';
  const heroCanopyLight = facadeProfile.heroCanopyLight ?? 'accent_spot';
  const heroBillboardTone = facadeProfile.heroBillboardTone ?? 'orange';

  const facadePrimary = createFacadeMaterial(
    doc,
    facadeMaterialFamily,
    facadeVariant,
  );
  const windowPrimary = createWindowGlassMaterial(doc, windowType);
  const entrancePrimary = createFacadeMaterial(
    doc,
    mapSurfaceToFacadeType(entranceSurface),
    'mid',
  );
  const roofEquipmentPrimary = createFacadeMaterial(
    doc,
    mapSurfaceToFacadeType(roofEquipmentSurface),
    'dark',
  );
  const heroCanopyPrimary = createBuildingLightMaterial(doc, heroCanopyLight);
  const heroRoofUnitPrimary = createFacadeMaterial(
    doc,
    mapSurfaceToFacadeType(roofEquipmentSurface),
    'mid',
  );
  const heroBillboardPrimary = createNeonSignMaterial(
    doc,
    heroBillboardTone,
    'bright',
  );

  return {
    ...baseMaterials,
    facadeBrickLight: createFacadeMaterial(doc, 'brick', 'light'),
    facadeBrickMid: createFacadeMaterial(doc, 'brick', 'mid'),
    facadeBrickDark: createFacadeMaterial(doc, 'brick', 'dark'),
    facadeConcreteLight: createFacadeMaterial(doc, 'concrete', 'light'),
    facadeConcreteMid: createFacadeMaterial(doc, 'concrete', 'mid'),
    facadeConcreteDark: createFacadeMaterial(doc, 'concrete', 'dark'),
    facadeGlassLight: createFacadeMaterial(doc, 'glass', 'light'),
    facadeGlassMid: createFacadeMaterial(doc, 'glass', 'mid'),
    facadeGlassDark: createFacadeMaterial(doc, 'glass', 'dark'),
    facadeMetalLight: createFacadeMaterial(doc, 'metal', 'light'),
    facadeMetalMid: createFacadeMaterial(doc, 'metal', 'mid'),
    facadeMetalDark: createFacadeMaterial(doc, 'metal', 'dark'),
    facadeModernGlassLight: createFacadeMaterial(doc, 'modern_glass', 'light'),
    facadeModernGlassMid: createFacadeMaterial(doc, 'modern_glass', 'mid'),
    facadeModernGlassDark: createFacadeMaterial(doc, 'modern_glass', 'dark'),
    windowGlassClear: createWindowGlassMaterial(doc, 'clear'),
    windowGlassTinted: createWindowGlassMaterial(doc, 'tinted'),
    windowGlassReflective: createWindowGlassMaterial(doc, 'reflective'),
    windowGlassCurtainWall: createWindowGlassMaterial(doc, 'curtain_wall'),
    neonSignRed: createNeonSignMaterial(doc, 'red'),
    neonSignOrange: createNeonSignMaterial(doc, 'orange'),
    neonSignYellow: createNeonSignMaterial(doc, 'yellow'),
    neonSignGreen: createNeonSignMaterial(doc, 'green'),
    neonSignCyan: createNeonSignMaterial(doc, 'cyan'),
    neonSignBlue: createNeonSignMaterial(doc, 'blue'),
    neonSignPurple: createNeonSignMaterial(doc, 'purple'),
    neonSignWhite: createNeonSignMaterial(doc, 'white'),
    neonSignPink: createNeonSignMaterial(doc, 'pink'),
    buildingLightWarmInterior: createBuildingLightMaterial(
      doc,
      'warm_interior',
    ),
    buildingLightCoolInterior: createBuildingLightMaterial(
      doc,
      'cool_interior',
    ),
    buildingLightAccentSpot: createBuildingLightMaterial(doc, 'accent_spot'),
    buildingLightFlood: createBuildingLightMaterial(doc, 'flood_light'),
    buildingLightWindowGlow: createBuildingLightMaterial(doc, 'window_glow'),
    facadePrimary,
    windowPrimary,
    entrancePrimary,
    roofEquipmentPrimary,
    heroCanopyPrimary,
    heroRoofUnitPrimary,
    heroBillboardPrimary,
  };
}

function resolveFacadeMaterialFamily(
  profile: FacadeLayerMaterialProfile,
): FacadeMaterialType {
  if (profile.windowType === 'curtain_wall') {
    return 'modern_glass';
  }
  if (profile.windowType === 'tinted' || profile.windowType === 'reflective') {
    return 'glass';
  }
  return 'concrete';
}

function mapSurfaceToFacadeType(
  surface: 'concrete' | 'metal' | 'glass',
): FacadeMaterialType {
  if (surface === 'metal') {
    return 'metal';
  }
  if (surface === 'glass') {
    return 'glass';
  }
  return 'concrete';
}
