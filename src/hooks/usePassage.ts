import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase.ts';
import type { PassageRow, VesselRow, WaypointRow } from '@/types/domain.ts';
import { readBundle, writeBundlePart } from '@/lib/offline-cache.ts';
import { reportOffline, reportOnline } from './useOffline.ts';

export type PassageBundle = { passage: PassageRow; vessel: VesselRow | null; waypoints: WaypointRow[] };

/** Throw on a PostgREST error so one catch handles both thrown fetch failures and returned error objects. */
export function must<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

export function usePassage(passageId: string | undefined) {
  const [data, setData] = useState<PassageBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!passageId) return;
    try {
      const passage = must(await supabase.from('passages').select('*').eq('id', passageId).maybeSingle());
      if (!passage) { setError('Passage not found'); setLoading(false); return; }
      const [vessel, waypoints] = await Promise.all([
        supabase.from('vessels').select('*').eq('id', passage.vessel_id).maybeSingle().then(must),
        supabase.from('waypoints').select('*').eq('passage_id', passageId).order('sequence').then(must),
      ]);
      setData({ passage, vessel: vessel ?? null, waypoints: waypoints ?? [] });
      setError(null);
      reportOnline();
      void writeBundlePart(passageId, { passage, vessel: vessel ?? null, waypoints: waypoints ?? [] });
    } catch (e) {
      // A failed read (offline, or the API unreachable): fall back to the last bundle cached for this passage.
      const cached = await readBundle(passageId);
      if (cached?.passage) {
        setData({ passage: cached.passage, vessel: cached.vessel ?? null, waypoints: cached.waypoints ?? [] });
        setError(null);
        reportOffline(cached.saved_at);
      } else {
        setError((e as Error).message);
      }
    }
    setLoading(false);
  }, [passageId]);
  useEffect(() => { if (passageId) void Promise.resolve().then(reload); }, [reload, passageId]);
  return { data, loading: passageId ? loading : false, error, reload };
}

export function usePassages() {
  const [passages, setPassages] = useState<PassageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    const { data } = await supabase.from('passages').select('*').order('planned_departure', { ascending: false });
    setPassages(data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void Promise.resolve().then(reload); }, [reload]);
  return { passages, loading, reload };
}
