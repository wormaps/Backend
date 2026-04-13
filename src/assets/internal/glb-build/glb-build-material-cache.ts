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
    const cached = cache.get(name);
    if (cached) {
      stats.hits += 1;
      return cached;
    }
    stats.misses += 1;
    const material = originalCreateMaterial(name);
    applyMaterialExtras(material, {
      sceneId,
      materialName: name,
      materialCacheKey: name,
    });
    cache.set(name, material);
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
