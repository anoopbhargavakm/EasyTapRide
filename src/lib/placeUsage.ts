import type { SavedPlace } from '../types';

export interface PlaceUsageEntry {
  count: number;
  lastUsedAt: number;
}

export type PlaceUsageMap = Record<string, PlaceUsageEntry>;

function storageKey(profileId: string): string {
  return `easytap_place_usage_${profileId}`;
}

export function getPlaceUsageMap(profileId: string): PlaceUsageMap {
  if (!profileId || typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey(profileId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as PlaceUsageMap;
  } catch {
    return {};
  }
}

export function recordPlaceUsage(profileId: string, placeId: string): PlaceUsageMap {
  const current = getPlaceUsageMap(profileId);
  if (!profileId || !placeId || typeof window === 'undefined') return current;
  const prev = current[placeId];
  const next: PlaceUsageMap = {
    ...current,
    [placeId]: {
      count: (prev?.count ?? 0) + 1,
      lastUsedAt: Date.now(),
    },
  };
  try {
    window.localStorage.setItem(storageKey(profileId), JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function sortPlacesByUsage(
  places: SavedPlace[],
  usageMap: PlaceUsageMap
): SavedPlace[] {
  if (places.length <= 1) return places;
  return [...places].sort((a, b) => {
    const aUsage = usageMap[a.id];
    const bUsage = usageMap[b.id];
    const countDiff = (bUsage?.count ?? 0) - (aUsage?.count ?? 0);
    if (countDiff !== 0) return countDiff;
    const recentDiff = (bUsage?.lastUsedAt ?? 0) - (aUsage?.lastUsedAt ?? 0);
    if (recentDiff !== 0) return recentDiff;
    return b.createdAt.localeCompare(a.createdAt);
  });
}
