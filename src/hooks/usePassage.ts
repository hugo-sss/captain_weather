import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase.ts';
import type { PassageRow, VesselRow, WaypointRow } from '@/types/domain.ts';

export type PassageBundle = { passage: PassageRow; vessel: VesselRow | null; waypoints: WaypointRow[] };

export function usePassage(passageId: string | undefined) {
  const [data, setData] = useState<PassageBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!passageId) return;
    const { data: passage, error: e1 } = await supabase.from('passages').select('*').eq('id', passageId).maybeSingle();
    if (e1 || !passage) { setError(e1?.message ?? 'Passage not found'); setLoading(false); return; }
    const [{ data: vessel }, { data: waypoints, error: e3 }] = await Promise.all([
      supabase.from('vessels').select('*').eq('id', passage.vessel_id).maybeSingle(),
      supabase.from('waypoints').select('*').eq('passage_id', passageId).order('sequence'),
    ]);
    if (e3) setError(e3.message);
    setData({ passage, vessel: vessel ?? null, waypoints: waypoints ?? [] });
    setError(null);
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
