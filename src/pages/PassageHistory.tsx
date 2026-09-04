import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase.ts';
import { usePassages } from '@/hooks/usePassage.ts';
import { useVessels } from '@/hooks/useVessels.ts';
import { Button } from '@/components/ui/button.tsx';
import { Badge } from '@/components/ui/badge.tsx';
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
  return (
    <div className="p-4 max-w-6xl">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-lg font-semibold">Passages</h1>
        <Button asChild size="sm" className="ml-auto"><Link to="/passages/new">New passage</Link></Button>
      </div>
      {vessels.length === 0 && !loading && <p className="text-sm text-text-2 mb-4">Create a <Link className="text-accent" to="/vessels/new">vessel</Link> first: cruise speed and thresholds drive every ETA and risk flag.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border"><tr><th className="label text-left py-1.5">Name</th><th className="label text-left">Vessel</th><th className="label text-left">Status</th><th className="label text-left">Departure (UTC)</th><th className="label text-left">Worst flag</th><th className="label text-left">Last run</th><th className="label text-left">Briefing confidence</th><th /></tr></thead>
          <tbody>
            {passages.map((p) => { const e = extra[p.id]; return (
              <tr key={p.id} className="border-b border-border hover:bg-bg-2/50">
                <td className="py-2"><Link className="text-text-1 hover:text-accent" to={`/passages/${p.id}`}>{p.name}</Link></td>
                <td>{vName(p.vessel_id)}</td>
                <td><Badge className={p.status === 'active' ? 'border-accent/50 text-accent' : 'border-border text-text-2'}>{p.status}</Badge></td>
                <td className="num">{fmtUtc(p.actual_departure ?? p.planned_departure)}</td>
                <td>{e?.worst ? <RiskPill flag={e.worst} /> : <span className="text-text-3 text-xs">no run</span>}</td>
                <td className="num text-xs text-text-2">{e?.runAt ? fmtAge(e.runAt) : '—'}</td>
                <td>{e?.confidence ? <span className="flex items-center gap-2"><ConfidenceDot level={e.confidence} withLabel /><span className="text-[11px] text-text-3">{fmtAge(e.briefingAt)}</span></span> : <span className="text-text-3 text-xs">none</span>}</td>
                <td className="text-right whitespace-nowrap"><Link className="text-xs text-text-2 hover:text-accent mr-3" to={`/passages/${p.id}/active`}>Monitor</Link><Link className="text-xs text-text-2 hover:text-accent" to={`/passages/${p.id}/edit`}>Edit</Link></td>
              </tr>); })}
            {passages.length === 0 && !loading && <tr><td colSpan={8} className="py-6 text-center text-text-3 text-sm">No passages yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
