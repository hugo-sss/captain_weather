// Offline cache: the last loaded passage bundle in IndexedDB, keyed by passage id. Hand-rolled because
// idb-keyval is not resolvable offline in the build sandbox. Every read is best-effort: a missing or
// broken IndexedDB never breaks the online path.
import type { AnchorageConditionsRow, BriefingRow, ConditionsRunRow, LegConditionsRow, PassageRow, VesselRow, WaypointConditionsRow, WaypointRow } from '@/types/domain.ts';

const DB = 'cpt-offline', STORE = 'bundles', VERSION = 1;

export type CachedBundle = {
  passage_id: string;
  saved_at: string; // ISO of the most recent write to any part
  passage?: PassageRow; vessel?: VesselRow | null; waypoints?: WaypointRow[];
  run?: ConditionsRunRow | null; conditions?: WaypointConditionsRow[]; legConditions?: LegConditionsRow[]; anchorages?: AnchorageConditionsRow[];
  briefing?: BriefingRow | null;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'passage_id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
    t.oncomplete = () => db.close();
  }));
}

export async function readBundle(passageId: string): Promise<CachedBundle | null> {
  try { return (await tx<CachedBundle | undefined>('readonly', (s) => s.get(passageId))) ?? null; } catch { return null; }
}

let chain: Promise<void> = Promise.resolve();

/** Merge one part into the cached bundle (each hook writes only what it loaded). Writes are serialised: several hooks finish at once and a read-merge-write race would drop parts. */
export function writeBundlePart(passageId: string, part: Partial<Omit<CachedBundle, 'passage_id' | 'saved_at'>>): Promise<void> {
  chain = chain.then(async () => {
    try {
      const cur = (await readBundle(passageId)) ?? { passage_id: passageId, saved_at: new Date().toISOString() };
      const next: CachedBundle = { ...cur, ...part, passage_id: passageId, saved_at: new Date().toISOString() };
      await tx('readwrite', (s) => s.put(next));
    } catch { /* best effort */ }
  });
  return chain;
}

export async function clearBundle(passageId: string): Promise<void> {
  try { await tx('readwrite', (s) => s.delete(passageId)); } catch { /* ignore */ }
}
