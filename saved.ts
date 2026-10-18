import { useSyncExternalStore } from "react";
import type { EntityType, Grant, ResolvedLocation, Tier } from "./grants.functions";
import type { ClientProfile } from "./eligibility";

export type AppStatus = "interested" | "applying" | "applied" | "awarded" | "declined";
export const STATUSES: { id: AppStatus; label: string }[] = [
  { id: "interested", label: "Interested" },
  { id: "applying", label: "Applying" },
  { id: "applied", label: "Applied" },
  { id: "awarded", label: "Awarded" },
  { id: "declined", label: "Declined" },
];

export interface Favorite {
  key: string;
  grant: Grant;
  tier: Tier;
  org: string;
  status: AppStatus;
  notes: string;
  savedAt: number;
}

export interface SavedSearch {
  profile?: ClientProfile;
  id: string;
  name: string;
  type: EntityType;
  focus: string;
  loc: ResolvedLocation;
  savedAt: number;
}

export const grantKey = (g: Grant) => `${g.foundation}::${g.program}`.toLowerCase().replace(/\s+/g, " ").trim();

const EVENT = "grantscope-storage";
const cache = new Map<string, { raw: string | null; value: unknown }>();

function read<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = fallback;
  try {
    if (raw) value = JSON.parse(raw);
  } catch {
    /* ignore */
  }
  cache.set(key, { raw, value });
  return value;
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

const EMPTY: never[] = [];

function useStored<T>(key: string): [T[], (next: T[]) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read<T[]>(key, EMPTY),
    () => EMPTY,
  );
  const set = (next: T[]) => {
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  };
  return [value, set];
}

export function useFavorites() {
  const [favs, setFavs] = useStored<Favorite>("grantscope:favorites");
  return {
    favs,
    isFav: (g: Grant) => favs.some((f) => f.key === grantKey(g)),
    toggle: (g: Grant, tier: Tier, org: string) => {
      const k = grantKey(g);
      setFavs(
        favs.some((f) => f.key === k)
          ? favs.filter((f) => f.key !== k)
          : [{ key: k, grant: g, tier, org, status: "interested", notes: "", savedAt: Date.now() }, ...favs],
      );
    },
    update: (key: string, patch: Partial<Favorite>) => setFavs(favs.map((f) => (f.key === key ? { ...f, ...patch } : f))),
    remove: (key: string) => setFavs(favs.filter((f) => f.key !== key)),
  };
}

export function useSavedSearches() {
  const [searches, setSearches] = useStored<SavedSearch>("grantscope:searches");
  return {
    searches,
    save: (s: Omit<SavedSearch, "id" | "savedAt">) =>
      setSearches([
        { ...s, id: crypto.randomUUID(), savedAt: Date.now() },
        ...searches.filter((x) => !(x.name === s.name && x.type === s.type && x.focus === s.focus)),
      ]),
    remove: (id: string) => setSearches(searches.filter((s) => s.id !== id)),
  };
}
