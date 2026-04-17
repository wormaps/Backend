import type { MaterialTuningOptions } from '../../compiler/materials';

export interface GlbSimplifyOptions {
  ratio: number;
  error: number;
  lockBorder: boolean;
}

const DEFAULT_GLB_SIMPLIFY_OPTIONS: GlbSimplifyOptions = {
  ratio: 0.75,
  error: 0.001,
  lockBorder: false,
};

const GLB_SIMPLIFY_RATIO_RANGE = {
  min: 0,
  max: 1,
} as const;

const GLB_SIMPLIFY_ERROR_RANGE = {
  min: 0.0001,
  max: 1,
} as const;

const ENV_GLB_OPTIMIZE_SIMPLIFY_ENABLED = 'GLB_OPTIMIZE_SIMPLIFY_ENABLED';
const ENV_GLB_OPTIMIZE_SIMPLIFY_RATIO = 'GLB_OPTIMIZE_SIMPLIFY_RATIO';
const ENV_GLB_OPTIMIZE_SIMPLIFY_ERROR = 'GLB_OPTIMIZE_SIMPLIFY_ERROR';
const ENV_GLB_OPTIMIZE_SIMPLIFY_LOCK_BORDER =
  'GLB_OPTIMIZE_SIMPLIFY_LOCK_BORDER';

export function resolveSimplifyOptionsFromEnv(): {
  enabled: boolean;
  options: GlbSimplifyOptions;
} {
  const enabled = parseBooleanEnv(
    process.env[ENV_GLB_OPTIMIZE_SIMPLIFY_ENABLED],
    true,
  );
  const ratio = parseNumericEnv(
    process.env[ENV_GLB_OPTIMIZE_SIMPLIFY_RATIO],
    DEFAULT_GLB_SIMPLIFY_OPTIONS.ratio,
    GLB_SIMPLIFY_RATIO_RANGE.min,
    GLB_SIMPLIFY_RATIO_RANGE.max,
  );
  const error = parseNumericEnv(
    process.env[ENV_GLB_OPTIMIZE_SIMPLIFY_ERROR],
    DEFAULT_GLB_SIMPLIFY_OPTIONS.error,
    GLB_SIMPLIFY_ERROR_RANGE.min,
    GLB_SIMPLIFY_ERROR_RANGE.max,
  );
  const lockBorder = parseBooleanEnv(
    process.env[ENV_GLB_OPTIMIZE_SIMPLIFY_LOCK_BORDER],
    DEFAULT_GLB_SIMPLIFY_OPTIONS.lockBorder,
  );

  return {
    enabled,
    options: {
      ratio,
      error,
      lockBorder,
    },
  };
}

export function buildMaterialTuningSignature(
  tuningOptions: MaterialTuningOptions,
): string {
  const normalized = {
    shellLuminanceCap: tuningOptions.shellLuminanceCap,
    panelLuminanceCap: tuningOptions.panelLuminanceCap,
    billboardLuminanceCap: tuningOptions.billboardLuminanceCap,
    emissiveBoost: tuningOptions.emissiveBoost,
    roadRoughnessScale: tuningOptions.roadRoughnessScale,
    wetRoadBoost: tuningOptions.wetRoadBoost,
    overlayDepthBias: tuningOptions.overlayDepthBias,
    weakEvidenceRatio: tuningOptions.weakEvidenceRatio,
    enableTexturePath: tuningOptions.enableTexturePath,
    inferenceReasonCodes: [...(tuningOptions.inferenceReasonCodes ?? [])].sort(),
    textureSlots: normalizeTextureSlots(tuningOptions.textureSlots),
  };

  return JSON.stringify(normalized);
}

function parseBooleanEnv(
  rawValue: string | undefined,
  fallback: boolean,
): boolean {
  const normalized = rawValue?.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseNumericEnv(
  rawValue: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const normalized = rawValue?.trim();
  if (!normalized) {
    return fallback;
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return clampRange(parsed, min, max);
}

function clampRange(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeTextureSlots(
  textureSlots: MaterialTuningOptions['textureSlots'],
): Record<string, unknown> {
  if (!textureSlots) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(textureSlots)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([slot, value]) => [
        slot,
        value
          ? {
              uri: value.uri,
              mimeType: value.mimeType ?? null,
              sampler: value.sampler
                ? {
                    magFilter: value.sampler.magFilter ?? null,
                    minFilter: value.sampler.minFilter ?? null,
                    wrapS: value.sampler.wrapS ?? null,
                    wrapT: value.sampler.wrapT ?? null,
                  }
                : null,
            }
          : null,
      ]),
  );
}
