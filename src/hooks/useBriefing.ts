import { useCallback, useEffect, useState } from 'react';
import { invokeFunction, supabase } from '@/lib/supabase.ts';
import type { BriefingRow } from '@/types/domain.ts';

export type BriefingResult = { briefing: BriefingRow | null; unavailable_reason?: string };

export function useBriefing(passageId: string | undefined) {
  const [briefing, setBriefing] = useState<BriefingRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!passageId) return;
    const { data } = await supabase.from('passage_briefings').select('*').eq('passage_id', passageId).is('superseded_by', null).order('generated_at', { ascending: false }).limit(1).maybeSingle();
    setBriefing(data ?? null);
  }, [passageId]);
  useEffect(() => { if (passageId) void Promise.resolve().then(reload); }, [reload, passageId]);
  const generate = useCallback(async (scope: 'full' | 'remaining' = 'full') => {
    if (!passageId) return;
    setBusy(true); setError(null);
    try { await invokeFunction('generate-briefing', { passage_id: passageId, scope }); await reload(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }, [passageId, reload]);
  return { briefing, busy, error, reload, generate };
}

/** What the UI may show. Never unvalidated text (non-negotiable 2). */
export function briefingDisplay(b: BriefingRow | null): { state: 'none' | 'ok' | 'unavailable'; reason?: string } {
  if (!b) return { state: 'none' };
  const vr = (b.validator_result ?? {}) as { passed?: boolean; error?: string; violations?: unknown[]; attempts?: number };
  if (b.validator_passed && b.summary_text) return { state: 'ok' };
  if (vr.error) return { state: 'unavailable', reason: vr.error };
  if (vr.violations?.length) return { state: 'unavailable', reason: `Briefing unavailable. Raw data below. (language validator failed after ${vr.attempts ?? 2} attempts)` };
  return { state: 'unavailable', reason: 'Briefing unavailable. Raw data below.' };
}
