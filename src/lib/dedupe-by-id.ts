/**
 * Deduplicate MARS project/sketch rows that share the same id.
 *
 * The same physical project can appear in multiple coastal water group / catchment
 * plans with plan-specific overlap metrics. When listing projects for a kommune
 * (flatMap across plans), duplicates break accordion expand state because React
 * keys and expandedId both collide on `id`.
 *
 * Keeps the row with the largest areaHa as the best available slice.
 */
export function dedupeByProjectId<T extends {
  id: string;
  areaHa?: number;
}>(items: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of items) {
    if (!item.id) continue;
    const existing = byId.get(item.id);
    if (!existing || (item.areaHa ?? 0) > (existing.areaHa ?? 0)) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}
