import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Pencil, Plus, Route } from 'lucide-react';
import { supabase } from '@/lib/supabase.ts';
import { usePassages } from '@/hooks/usePassage.ts';
import { useVessels } from '@/hooks/useVessels.ts';
import { Button } from '@/components/ui/button.tsx';
import { StatusBadge } from '@/components/ui/badge.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { RiskPill } from '@/components/dashboard/RiskPill.tsx';
import { ConfidenceDot } from '@/components/briefing/ConfidenceDot.tsx';
import { fmtAge, fmtUtc } from '@/lib/time.ts';
import type { ConfidenceLevel, RiskFlag } from '@/types/domain.ts';
import { worstRisk } from '../../supabase/functions/_shared/risk.ts';

type Extra = { worst: RiskFlag | null; runAt: string | null; confidence: ConfidenceLevel | null; briefingAt: string | null };

export default function PassageHistory() {
  const { passages, loading } = usePassages();
  const { vessels } = useVessels();
  const [extra, setExtra] = useState<Record<string, Extra>>({});
  const ids = passages.map((p) => p.id).join(',');
  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    (async () => {
      const pids = ids.split(',');
      const [{ data: runs }, { data: briefs }] = await Promise.all([
        supabase.from('conditions_runs').select('id, passage_id, completed_at, created_at').in('passage_id', pids).eq('status', 'complete').order('created_at', { ascending: false }),
        supabase.from('passage_briefings').select('passage_id, confidence_level, generated_at').in('passage_id', pids).is('superseded_by', null).order('generated_at', { ascending: false }),
      ]);
      const latestRun = new Map<string, { id: string; at: string }>();
      for (const r of runs ?? []) if (!latestRun.has(r.passage_id)) latestRun.set(r.passage_id, { id: r.id, at: r.completed_at ?? r.created_at });
      const runIds = [...latestRun.values()].map((r) => r.id);
      const { data: flags } = runIds.length ? await supabase.from('waypoint_conditions').select('run_id, risk_flag').in('run_id', runIds) : { data: [] as { run_id: string; risk_flag: string }[] };
      const byRun = new Map<string, RiskFlag[]>();
      for (const f of flags ?? []) byRun.set(f.run_id, [...(byRun.get(f.run_id) ?? []), f.risk_flag as RiskFlag]);
      const latestBrief = new Map<string, { confidence: ConfidenceLevel; at: string }>();
      for (const b of briefs ?? []) if (!latestBrief.has(b.passage_id)) latestBrief.set(b.passage_id, { confidence: b.confidence_level as ConfidenceLevel, at: b.generated_at });
      if (cancelled) return;
      const out: Record<string, Extra> = {};
      for (const pid of pids) {
        const r = latestRun.get(pid); const b = latestBrief.get(pid);
        const fl = r ? byRun.get(r.id) ?? [] : [];
        out[pid] = { worst: fl.length ? worstRisk(fl) : null, runAt: r?.at ?? null, confidence: b?.confidence ?? null, briefingAt: b?.at ?? null };
      }
      setExtra(out);
    })();
    return () => { cancelled = true; };
  }, [ids]);
  const vName = (id: string) => vessels.find((v) => v.id === id)?.name ?? '—';
  const active = passages.filter((p) => p.status === 'active').length;
  return (
    <div className="p-4 md:p-6 max-w-6xl w-full">
      <div className="flex items-center gap-3 mb-4">
        <div>
          <h1 className="text-lg font-semibold leading-tight">Passages</h1>
          <p className="text-[11px] text-text-3 mt-0.5">{loading ? 'loading' : <><span className="num">{passages.length}</span> total{active > 0 && <> · <span className="num text-accent">{active}</span> active</>}</>}</p>
        </div>
        <Button asChild size="sm" className="ml-auto"><Link to="/passages/new"><Plus className="h-3.5 w-3.5" /> New passage</Link></Button>
      </div>
      {vessels.length === 0 && !loading && <p className="mb-4 rounded-md border border-risk-amber/40 bg-risk-amber/10 px-3 py-2 text-sm text-risk-amber">Create a <Link className="underline underline-offset-2" to="/vessels/new">vessel</Link> first: cruise speed and thresholds drive every ETA and risk flag.</p>}

      {loading && <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-11" />)}</div>}
      {!loading && passages.length === 0 && (
        <div className="gap-hatch rounded-lg border border-dashed border-border py-12 text-center">
          <Route className="h-6 w-6 mx-auto text-text-3 mb-2" />
          <p className="text-sm text-text-2">No passages yet.</p>
          <p className="text-xs text-text-3 mt-1">Import a GPX or drop pins on the map to plan the first one.</p>
        </div>
      )}

      {!loading && passages.length > 0 && (
        <>
          {/* Mobile: stacked cards with the same fields. */}
          <ul className="md:hidden space-y-2">
            {passages.map((p) => { const e = extra[p.id]; return (
              <li key={p.id} className="panel p-3">
                <div className="flex items-center gap-2"><Link className="font-medium flex-1 truncate hover:text-accent" to={`/passages/${p.id}`}>{p.name}</Link><StatusBadge status={p.status} /></div>
                <div className="mt-1 text-[11px] text-text-3">{vName(p.vessel_id)} · <span className="num">{fmtUtc(p.actual_departure ?? p.planned_departure)}</span></div>
                <div className="mt-2 flex items-center gap-3 text-xs">
                  {e?.worst ? <RiskPill flag={e.worst} size="sm" /> : <span className="text-text-3">no run</span>}
                  {e?.confidence && <ConfidenceDot level={e.confidence} withLabel />}
                  <span className="num text-text-3 ml-auto">{e?.runAt ? fmtAge(e.runAt) : ''}</span>
                </div>
              </li>); })}
          </ul>
          <div className="hidden md:block panel overflow-hidden">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Vessel</th><th>Status</th><th>Departure (UTC)</th><th>Worst flag</th><th>Last run</th><th>Briefing confidence</th><th className="r" /></tr></thead>
              <tbody>
                {passages.map((p) => { const e = extra[p.id]; return (
                  <tr key={p.id} className="group">
                    <td className="!py-2.5"><Link className="font-medium text-text-1 hover:text-accent" to={`/passages/${p.id}`}>{p.name}</Link></td>
                    <td className="text-text-2">{vName(p.vessel_id)}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td className="num text-text-2">{fmtUtc(p.actual_departure ?? p.planned_departure)}</td>
                    <td>{e?.worst ? <RiskPill flag={e.worst} size="sm" /> : <span className="text-text-3 text-xs">no run</span>}</td>
                    <td className="num text-xs text-text-2">{e?.runAt ? fmtAge(e.runAt) : '—'}</td>
                    <td>{e?.confidence ? <span className="flex items-center gap-2"><ConfidenceDot level={e.confidence} withLabel /><span className="num text-[11px] text-text-3">{fmtAge(e.briefingAt)}</span></span> : <span className="text-text-3 text-xs">none</span>}</td>
                    <td className="r">
                      <span className="inline-flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        <Link className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-text-2 hover:bg-bg-2 hover:text-text-1" to={`/passages/${p.id}/active`}><Activity className="h-3.5 w-3.5" /> Monitor</Link>
                        <Link className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-text-2 hover:bg-bg-2 hover:text-text-1" to={`/passages/${p.id}/edit`}><Pencil className="h-3.5 w-3.5" /> Edit</Link>
                      </span>
                    </td>
                  </tr>); })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
