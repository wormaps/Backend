export interface MaterialCacheStats {
  hits: number;
  misses: number;
}

export interface MaterialReuseDiagnostics {
  materialReuseRate: number;
  totalMaterialsCreated: number;
  uniqueMaterialKeys: number;
  hits: number;
  misses: number;
  instancedGroupCount: number;
  instancedBuildingCount: number;
}

const MAX_MATERIAL_CACHE_SIZE = 500;

export function installMaterialCache(
  doc: Record<string, unknown>,
  sceneId: string,
  stats: MaterialCacheStats,
  tuningSignature = 'default',
): void {
  const originalCreateMaterial = (
    doc.createMaterial as (name: string) => unknown
  ).bind(doc);
  const cache = new Map<string, unknown>();
  (doc as Record<string, unknown>).createMaterial = (name: string) => {
    const stableKey = buildMaterialCacheKey(sceneId, tuningSignature, name);
    const cached = cache.get(stableKey);
    if (cached) {
      stats.hits += 1;
      return cached;
    }
    stats.misses += 1;
    const material = originalCreateMaterial(name);
    applyMaterialExtras(material, {
      sceneId,
      materialName: name,
      materialCacheKey: stableKey,
    });
    if (cache.size >= MAX_MATERIAL_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    cache.set(stableKey, material);
    return material;
  };
}

export function computeMaterialReuseDiagnostics(
  stats: MaterialCacheStats,
  instancedGroupCount = 0,
  instancedBuildingCount = 0,
): MaterialReuseDiagnostics {
  const totalMaterialsCreated = stats.hits + stats.misses;
  const uniqueMaterialKeys = stats.misses;
  const materialReuseRate =
    totalMaterialsCreated > 0
      ? Number((stats.hits / totalMaterialsCreated).toFixed(3))
      : 0;
  return {
    materialReuseRate,
    totalMaterialsCreated,
    uniqueMaterialKeys,
    hits: stats.hits,
    misses: stats.misses,
    instancedGroupCount,
    instancedBuildingCount,
  };
}

export function applyMaterialExtras(
  material: unknown,
  extras: Record<string, unknown>,
): void {
  if (typeof (material as Record<string, unknown>)?.setExtras === 'function') {
    (
      (material as Record<string, unknown>).setExtras as (
        extras: Record<string, unknown>,
      ) => void
    )(extras);
    return;
  }
  if (typeof (material as Record<string, unknown>)?.setExtra === 'function') {
    (
      (material as Record<string, unknown>).setExtra as (
        key: string,
        value: unknown,
      ) => void
    )('wormap', extras);
  }
}

export function applyExtras(
  target: unknown,
  extras: Record<string, unknown>,
): void {
  if (typeof (target as Record<string, unknown>)?.setExtras === 'function') {
    (
      (target as Record<string, unknown>).setExtras as (
        extras: Record<string, unknown>,
      ) => void
    )(extras);
  }
}

export function buildMaterialCacheKey(
  sceneId: string,
  tuningSignature: string,
  name: string,
): string {
  // Shell pattern: building-shell-${materialClass}-${hexOrBucket}
  // Normalize: extract materialClass, replace exact hex with bucket
  const shellMatch = name.match(/^building-shell-([a-z]+)-(.+)$/);
  if (shellMatch) {
    const materialClass = shellMatch[1];
    const colorPart = shellMatch[2];
    const bucket = normalizeColorToBucket(colorPart);
    return `${sceneId}::${tuningSignature}::building-shell::${materialClass}::${bucket}`;
  }
  // Panel pattern: building-panel-${tone}-${hex}
  // Normalize: replace exact hex with quantized bucket
  const panelMatch = name.match(/^building-panel-([a-z]+)-(.+)$/);
  if (panelMatch) {
    const hexPrefix = quantizeHexToBucket(panelMatch[2]);
    return `${sceneId}::${tuningSignature}::building-panel::${panelMatch[1]}::${hexPrefix}`;
  }
  // Billboard pattern: billboard-${tone}-${hex}
  // Normalize: replace exact hex with quantized bucket
  const billboardMatch = name.match(/^billboard-([a-z]+)-(.+)$/);
  if (billboardMatch) {
    const hexPrefix = quantizeHexToBucket(billboardMatch[2]);
    return `${sceneId}::${tuningSignature}::billboard::${billboardMatch[1]}::${hexPrefix}`;
  }
  // Default: sceneId + name
  return `${sceneId}::${tuningSignature}::${name}`;
}

/**
 * Normalize a color string (hex or bucket name) to a canonical bucket.
 * If the input is already a known bucket name, return it as-is.
 * If it's a hex color, quantize it to the nearest bucket.
 */
function normalizeColorToBucket(colorPart: string): string {
  // Known bucket names pass through
  const knownBuckets = new Set([
    'cool-light',
    'cool-mid',
    'neutral-light',
    'neutral-mid',
    'neutral-dark',
    'warm-light',
    'warm-mid',
    'brick',
  ]);
  if (knownBuckets.has(colorPart)) {
    return colorPart;
  }
  // Hex color: quantize to bucket
  return quantizeHexToBucket(colorPart);
}

/**
 * Quantize a hex color to a 3-character prefix bucket.
 * Brightness is rounded to 8-unit steps (32 buckets), hue to 15-degree steps (24 buckets).
 * Returns a short bucket identifier for cache key deduplication.
 */
function quantizeHexToBucket(hex: string): string {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{3,6}$/.test(normalized)) {
    return hex;
  }
  if (normalized.length < 3) {
    return normalized;
  }
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => `${c}${c}`)
          .join('')
      : normalized;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);

  // Brightness bucket (0-255 in 8-unit steps → 0-1F)
  const brightness = Math.round((r * 0.299 + g * 0.587 + b * 0.114) / 8);
  const brightnessBucket = Math.max(0, Math.min(31, brightness)).toString(16);

  // Hue bucket (15-degree steps → 0-17 for 24 hue segments)
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hueBucket = 0;
  if (delta > 0) {
    let hue = 0;
    if (max === r) {
      hue = (((g - b) / delta) % 6) * 60;
    } else if (max === g) {
      hue = ((b - r) / delta + 2) * 60;
    } else {
      hue = ((r - g) / delta + 4) * 60;
    }
    if (hue < 0) hue += 360;
    hueBucket = Math.round(hue / 15) % 24;
  }

  return `${brightnessBucket}${hueBucket.toString(16)}`;
}
