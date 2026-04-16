export interface MaterialCacheStats {
  hits: number;
  misses: number;
}

export function installMaterialCache(
  doc: Record<string, unknown>,
  sceneId: string,
  stats: MaterialCacheStats,
): void {
  const originalCreateMaterial = (
    doc.createMaterial as (name: string) => unknown
  ).bind(doc);
  const cache = new Map<string, unknown>();
  (doc as Record<string, unknown>).createMaterial = (name: string) => {
    const stableKey = buildStableCacheKey(sceneId, name);
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
    cache.set(stableKey, material);
    return material;
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

function buildStableCacheKey(sceneId: string, name: string): string {
  // Shell pattern: building-shell-${materialClass}-${hexOrBucket}
  const shellMatch = name.match(/^building-shell-([a-z]+)-(.+)$/);
  if (shellMatch) {
    return `${sceneId}::building-shell::${shellMatch[1]}::${shellMatch[2]}`;
  }
  // Panel pattern: building-panel-${tone}-${hex}
  const panelMatch = name.match(/^building-panel-([a-z]+)-(.+)$/);
  if (panelMatch) {
    const hexPrefix = panelMatch[2].replace('#', '').slice(0, 3).toLowerCase();
    return `${sceneId}::building-panel::${panelMatch[1]}::${hexPrefix}`;
  }
  // Billboard pattern: billboard-${tone}-${hex}
  const billboardMatch = name.match(/^billboard-([a-z]+)-(.+)$/);
  if (billboardMatch) {
    const hexPrefix = billboardMatch[2]
      .replace('#', '')
      .slice(0, 3)
      .toLowerCase();
    return `${sceneId}::billboard::${billboardMatch[1]}::${hexPrefix}`;
  }
  // Default: sceneId + name
  return `${sceneId}::${name}`;
}
