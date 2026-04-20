import type {
  AccentTone,
  FacadeLayerMaterialProfile,
  GlbMaterial,
  MaterialTuningOptions,
  ShellColorBucket,
  TextureDiagnostics,
  TextureSlot,
} from './glb-material-factory.scene';
import type { MaterialClass } from '../../../scene/types/scene.types';

const DEFAULT_MATERIAL_TUNING: Required<MaterialTuningOptions> = {
  shellLuminanceCap: 0.88,
  panelLuminanceCap: 0.78,
  billboardLuminanceCap: 0.84,
  emissiveBoost: 1,
  roadRoughnessScale: 1,
  wetRoadBoost: 0,
  overlayDepthBias: 1,
  inferenceReasonCodes: [],
  weakEvidenceRatio: 0,
  resolvedFallbackSource: 'STATIC_DEFAULT',
  textureSlots: {},
  enableTexturePath: false,
};

export function resolvePanelRoughness(
  bias: FacadeLayerMaterialProfile['panelSurfaceBias'],
): number {
  switch (bias) {
    case 'glossy':
      return 0.58;
    case 'matte':
      return 0.86;
    default:
      return 0.74;
  }
}

export function applySurfaceBias(
  surface: { metallicFactor: number; roughnessFactor: number },
  bias: FacadeLayerMaterialProfile['shellSurfaceBias'],
): { metallicFactor: number; roughnessFactor: number } {
  if (bias === 'glossy') {
    return {
      metallicFactor: clamp01(surface.metallicFactor + 0.06),
      roughnessFactor: clamp01(surface.roughnessFactor * 0.78),
    };
  }
  if (bias === 'matte') {
    return {
      metallicFactor: clamp01(surface.metallicFactor * 0.6),
      roughnessFactor: clamp01(surface.roughnessFactor * 1.08),
    };
  }
  return surface;
}

export function resolveShellBucketHex(bucket: ShellColorBucket): string {
  switch (bucket) {
    case 'cool-light':
      return '#8fa7ba';
    case 'cool-mid':
      return '#6f899d';
    case 'neutral-light':
      return '#b8bec5';
    case 'neutral-mid':
      return '#8f98a1';
    case 'neutral-dark':
      return '#626c75';
    case 'warm-light':
      return '#b69681';
    case 'warm-mid':
      return '#8d6c57';
    case 'brick':
      return '#b36a4f';
  }
}

export function resolveShellSurface(materialClass: MaterialClass): {
  metallicFactor: number;
  roughnessFactor: number;
} {
  switch (materialClass) {
    case 'glass':
      return { metallicFactor: 0.02, roughnessFactor: 0.16 };
    case 'metal':
      return { metallicFactor: 0.32, roughnessFactor: 0.42 };
    case 'brick':
      return { metallicFactor: 0, roughnessFactor: 0.94 };
    case 'concrete':
      return { metallicFactor: 0, roughnessFactor: 0.88 };
    default:
      return { metallicFactor: 0.04, roughnessFactor: 0.82 };
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const red = parseInt(normalized.slice(0, 2), 16) / 255;
  const green = parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = parseInt(normalized.slice(4, 6), 16) / 255;
  return [red, green, blue];
}

export function tuneShellColor(
  color: [number, number, number],
  materialClass: MaterialClass,
  luminanceCap: number,
): [number, number, number] {
  const adaptiveCap = resolveAdaptiveLuminanceCap(color, luminanceCap, 0.06);
  const [r, g, b] = compressLuminance(color, adaptiveCap);
  if (materialClass === 'glass') {
    return [
      clamp01(r * 0.95),
      clamp01(g * 0.97),
      clamp01(Math.max(b * 1.02, r * 0.98)),
    ];
  }
  if (materialClass === 'brick') {
    return [clamp01(r * 0.95), clamp01(g * 0.94), clamp01(b * 0.92)];
  }
  return [clamp01(r * 0.97), clamp01(g * 0.97), clamp01(b * 0.97)];
}

export function tunePanelColor(
  color: [number, number, number],
  tone: AccentTone,
  luminanceCap: number,
): [number, number, number] {
  const adaptiveCap = resolveAdaptiveLuminanceCap(color, luminanceCap, 0.08);
  const [r, g, b] = compressLuminance(color, adaptiveCap);
  if (tone === 'cool') {
    return [clamp01(r * 0.88), clamp01(g * 0.92), clamp01(b * 0.98)];
  }
  if (tone === 'warm') {
    return [clamp01(r * 0.96), clamp01(g * 0.88), clamp01(b * 0.84)];
  }
  return [clamp01(r * 0.9), clamp01(g * 0.9), clamp01(b * 0.9)];
}

export function tuneBillboardColor(
  color: [number, number, number],
  tone: AccentTone,
  luminanceCap: number,
): [number, number, number] {
  const adaptiveCap = resolveAdaptiveLuminanceCap(color, luminanceCap, 0.05);
  const [r, g, b] = compressLuminance(color, adaptiveCap);
  if (tone === 'cool') {
    return [clamp01(r * 0.94), clamp01(g * 0.98), clamp01(b)];
  }
  if (tone === 'warm') {
    return [clamp01(r), clamp01(g * 0.92), clamp01(b * 0.9)];
  }
  return [clamp01(r * 0.95), clamp01(g * 0.95), clamp01(b * 0.95)];
}

export function compressLuminance(
  color: [number, number, number],
  maxLuminance: number,
): [number, number, number] {
  const [r, g, b] = color;
  const luminance = r * 0.299 + g * 0.587 + b * 0.114;
  if (luminance <= maxLuminance) {
    return color;
  }
  const scale = maxLuminance / Math.max(luminance, 1e-6);
  return [r * scale, g * scale, b * scale];
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function clampRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function resolveAdaptiveLuminanceCap(
  color: [number, number, number],
  baseCap: number,
  maxBoost: number,
): number {
  const [r, g, b] = color;
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);
  const luminance = r * 0.299 + g * 0.587 + b * 0.114;
  const boost = Math.min(maxBoost, saturation * 0.1 + (1 - luminance) * 0.03);
  return clamp01(baseCap + boost);
}

export function resolveMaterialTuningOptions(
  tuningOptions: MaterialTuningOptions,
): Required<MaterialTuningOptions> {
  const weakEvidenceRatio = clampRange(
    tuningOptions.weakEvidenceRatio ??
      DEFAULT_MATERIAL_TUNING.weakEvidenceRatio,
    0,
    1,
  );
  const weakEvidencePenalty = 1 - weakEvidenceRatio * 0.22;
  return {
    shellLuminanceCap:
      tuningOptions.shellLuminanceCap ??
      DEFAULT_MATERIAL_TUNING.shellLuminanceCap,
    panelLuminanceCap:
      tuningOptions.panelLuminanceCap ??
      DEFAULT_MATERIAL_TUNING.panelLuminanceCap,
    billboardLuminanceCap:
      tuningOptions.billboardLuminanceCap ??
      DEFAULT_MATERIAL_TUNING.billboardLuminanceCap,
    emissiveBoost: clampRange(
      (tuningOptions.emissiveBoost ?? DEFAULT_MATERIAL_TUNING.emissiveBoost) *
        weakEvidencePenalty,
      0,
      2.4,
    ),
    roadRoughnessScale:
      tuningOptions.roadRoughnessScale ??
      DEFAULT_MATERIAL_TUNING.roadRoughnessScale,
    wetRoadBoost:
      tuningOptions.wetRoadBoost ?? DEFAULT_MATERIAL_TUNING.wetRoadBoost,
    overlayDepthBias:
      tuningOptions.overlayDepthBias ??
      DEFAULT_MATERIAL_TUNING.overlayDepthBias,
    inferenceReasonCodes:
      tuningOptions.inferenceReasonCodes ??
      DEFAULT_MATERIAL_TUNING.inferenceReasonCodes,
    weakEvidenceRatio,
    resolvedFallbackSource:
      tuningOptions.resolvedFallbackSource ??
      DEFAULT_MATERIAL_TUNING.resolvedFallbackSource,
    textureSlots:
      tuningOptions.textureSlots ?? DEFAULT_MATERIAL_TUNING.textureSlots,
    enableTexturePath:
      tuningOptions.enableTexturePath ??
      DEFAULT_MATERIAL_TUNING.enableTexturePath,
  };
}

export function resolveOverlayDepthBias(value: number): number {
  return clampRange(value, 0.4, 2.4);
}

export function applyWetRoad(baseRoughness: number, wetRoadBoost: number): number {
  const wetAdjusted = baseRoughness * (1 - clamp01(wetRoadBoost) * 0.38);
  return clamp01(wetAdjusted);
}

export function applyWetOverlay(baseRoughness: number, wetRoadBoost: number): number {
  const wetAdjusted = baseRoughness * (1 - clamp01(wetRoadBoost) * 0.2);
  return clamp01(wetAdjusted);
}

export function scaleEmissive(
  values: [number, number, number],
  factor: number,
): [number, number, number] {
  return [
    clamp01(values[0] * factor),
    clamp01(values[1] * factor),
    clamp01(values[2] * factor),
  ];
}

export function scaleRoughness(value: number, factor: number): number {
  return clamp01(value * factor);
}

export function applyTextureSlotIfAvailable(
  material: GlbMaterial,
  textureSlot: TextureSlot | undefined,
  enableTexturePath: boolean,
): void {
  if (!enableTexturePath || !textureSlot) {
    return;
  }
  if (typeof material.setBaseColorTexture === 'function') {
    material.setBaseColorTexture(textureSlot);
  }
}

export function resolveTextureDiagnostics(
  tuning: Required<MaterialTuningOptions>,
): TextureDiagnostics {
  const hasTextureSlots =
    tuning.enableTexturePath &&
    (tuning.textureSlots.ground !== undefined ||
      tuning.textureSlots.roadBase !== undefined ||
      tuning.textureSlots.sidewalk !== undefined ||
      tuning.textureSlots.buildingShell !== undefined);

  if (!tuning.enableTexturePath) {
    return {
      texturePathActive: false,
      fallbackPathActive: true,
      reason: 'enableTexturePath is false',
    };
  }

  if (!hasTextureSlots) {
    return {
      texturePathActive: false,
      fallbackPathActive: true,
      reason: 'No texture slots provided',
    };
  }

  const activeSlots: string[] = [];
  if (tuning.textureSlots.ground) activeSlots.push('ground');
  if (tuning.textureSlots.roadBase) activeSlots.push('roadBase');
  if (tuning.textureSlots.sidewalk) activeSlots.push('sidewalk');
  if (tuning.textureSlots.buildingShell) activeSlots.push('buildingShell');

  return {
    texturePathActive: true,
    fallbackPathActive: false,
    textureSlotUsed: activeSlots.join(', '),
    reason: `Texture path active for: ${activeSlots.join(', ')}`,
  };
}
