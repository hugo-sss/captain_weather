import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase.ts';
import type { LegConditionsRow, WaypointRow } from '@/types/domain.ts';
import { groupLegConditions, type LegProfileData } from '@/lib/leg-profile.ts';
import { readBundle, writeBundlePart } from '@/lib/offline-cache.ts';
import { reportOffline } from './useOffline.ts';

/**
 * Conditions at the virtual points between waypoints for one run, ordered along each leg.
 * Query: leg_conditions where run_id = :runId order by from_waypoint_id, seq. Grouped by (from, to) in the UI.
 * `passageId` keys the offline cache; without it the rows are not cached.
 */
export function useLegConditions(runId: string | null | undefined, passageId?: string | null) {
  const [state, setState] = useState<{ runId: string | null; rows: LegConditionsRow[] }>({ runId: null, rows: [] });
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('leg_conditions').select('*').eq('run_id', runId).order('from_waypoint_id').order('seq');
      if (cancelled) return;
      if (error) {
        const cached = passageId ? await readBundle(passageId) : null;
        if (cancelled) return;
        if (cached?.legConditions) { setState({ runId, rows: cached.legConditions.filter((r) => r.run_id === runId) }); reportOffline(cached.saved_at); }
        else setState({ runId, rows: [] });
      } else {
        setState({ runId, rows: data ?? [] });
        if (passageId) void writeBundlePart(passageId, { legConditions: data ?? [] });
      }
    })();
    return () => { cancelled = true; };
  }, [runId, passageId]);
  const current = runId !== null && runId !== undefined && state.runId === runId;
  return { rows: current ? state.rows : [], loading: !!runId && !current };
}

/** Grouped per leg in passage order. */
export function useLegProfiles(rows: LegConditionsRow[], waypoints: WaypointRow[]): LegProfileData[] {
  return useMemo(() => groupLegConditions(rows, waypoints), [rows, waypoints]);
}
