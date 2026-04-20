export function mergeByObjectId<T extends { objectId: string }>(
  base: T[],
  overrides: T[],
): T[] {
  const map = new Map<string, T>();
  for (const item of base) {
    map.set(item.objectId, item);
  }
  for (const item of overrides) {
    map.set(item.objectId, item);
  }
  return [...map.values()];
}
