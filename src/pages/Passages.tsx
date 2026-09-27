// /passages: every passage as a card, grouped by what the captain is doing with it: Underway, Upcoming, Past.
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Pencil, Plus, Route, Ship, Trash2, ArrowUpRight } from 'lucide-react';
import { supabase } from '@/lib/supabase.ts';
import { usePassageSummaries, type PassageSummary } from '@/hooks/usePassageSummaries.ts';
import { useDisplayPrefs } from '@/hooks/useDisplayPrefs.ts';
import { useNow } from '@/hooks/useNow.ts';
import { PageHeader } from '@/components/PageHeader.tsx';
import { Button } from '@/components/ui/button.tsx';
import { EmptyState } from '@/components/ui/empty-state.tsx';
import { DropdownMenu } from '@/components/ui/dropdown-menu.tsx';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog.tsx';
import { PageSkeleton } from '@/components/ui/skeleton.tsx';
import { StatusBadge } from '@/components/ui/badge.tsx';
import { RiskDot } from '@/components/dashboard/RiskPill.tsx';
import { ConfidenceDot } from '@/components/briefing/ConfidenceDot.tsx';
import { agePhrase, distancePhrase, riskHeadline, whenPhrase } from '@/lib/plain.ts';
import { cn } from '@/lib/utils.ts';

type Group = { key: 'underway' | 'upcoming' | 'past'; title: string; items: PassageSummary[]; compact?: boolean };

export default function Passages() {
  const { summaries, vessels, loading, reload } = usePassageSummaries();
  const { prefs } = useDisplayPrefs();
  const now = useNow(60_000);
  const nav = useNavigate();
  const [pendingDelete, setPendingDelete] = useState<PassageSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const groups = useMemo<Group[]>(() => {
    const byDep = (a: PassageSummary, b: PassageSummary) => Date.parse(a.passage.planned_departure) - Date.parse(b.passage.planned_departure);
    const underway = summaries.filter((s) => s.passage.status === 'active').sort(byDep);
    const upcoming = summaries.filter((s) => s.passage.status === 'planned').sort(byDep);
    const past = summaries.filter((s) => s.passage.status === 'completed' || s.passage.status === 'archived').sort((a, b) => byDep(b, a));
    return [
      { key: 'underway', title: 'Underway', items: underway },
      { key: 'upcoming', title: 'Upcoming', items: upcoming },
      { key: 'past', title: 'Past', items: past, compact: true },
    ].filter((g) => g.items.length > 0) as Group[];
  }, [summaries]);

  const duplicate = async (s: PassageSummary) => {
    setBusy(true);
    try {
      const p = s.passage;
      const ins = await supabase.from('passages').insert({ name: `${p.name} copy`, vessel_id: p.vessel_id, planned_departure: p.planned_departure, tropical_activity_flag: p.tropical_activity_flag, frontal_activity_flag: p.frontal_activity_flag, notes: p.notes }).select('id').single();
      if (ins.error || !ins.data) throw new Error(ins.error?.message ?? 'copy failed');
      const { data: wps } = await supabase.from('waypoints').select('*').eq('passage_id', p.id).order('sequence');
      if (wps && wps.length) {
        const rows = wps.map((w) => ({ passage_id: ins.data.id, sequence: w.sequence, name: w.name, lat: w.lat, lon: w.lon, planned_speed_kn: w.planned_speed_kn, is_anchorage: w.is_anchorage, planned_departure_from_here: w.planned_departure_from_here, anchorage_exposure_tag: w.anchorage_exposure_tag, is_complex_coastal: w.is_complex_coastal, charted_depth_m: w.charted_depth_m, charted_depth_source: w.charted_depth_source, source: w.source }));
        await supabase.from('waypoints').insert(rows);
      }
      nav(`/passages/${ins.data.id}/edit`);
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try { await supabase.from('passages').delete().eq('id', pendingDelete.passage.id); await reload(); }
    finally { setBusy(false); setPendingDelete(null); }
  };

  if (loading) return <PageSkeleton variant="list" />;
  const underwayCount = summaries.filter((s) => s.passage.status === 'active').length;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader title="Passages" description={<span>{summaries.length === 0 ? 'Nothing planned yet' : `${summaries.length} ${summaries.length === 1 ? 'passage' : 'passages'}${underwayCount ? `, ${underwayCount} underway` : ''}`}</span>}
        actions={<Button asChild><Link to="/passages/new"><Plus /> New passage</Link></Button>} />
      <div className="px-4 md:px-6 pb-8 max-w-5xl w-full space-y-8">
        {vessels.length === 0 && (
          <EmptyState icon={Ship} title="Add your vessel first" body="Cruise speed and limits drive every ETA and risk flag." action={<Button asChild><Link to="/vessels/new"><Plus /> Add vessel</Link></Button>} compact />
        )}
        {vessels.length > 0 && summaries.length === 0 && (
          <EmptyState icon={Route} title="No passages yet" body="Drop pins on the weather map or import a GPX file to plan the first one." action={<Button asChild><Link to="/passages/new"><Plus /> New passage</Link></Button>} />
        )}
        {groups.map((g) => (
          <section key={g.key} aria-labelledby={`grp-${g.key}`}>
            <div className="flex items-baseline gap-2 mb-3"><h2 id={`grp-${g.key}`} className="t-section">{g.title}</h2><span className="t-caption num">{g.items.length}</span></div>
            <div className={cn('grid gap-3', g.compact && 'gap-2')}>
              {g.items.map((s) => <PassageCard key={s.passage.id} s={s} compact={g.compact} now={now} utcOffsetMin={prefs.local_utc_offset_min} onDuplicate={() => void duplicate(s)} onDelete={() => setPendingDelete(s)} busy={busy} />)}
            </div>
          </section>
        ))}
      </div>
      <Dialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
        <DialogContent className="max-w-md">
          <DialogTitle>Delete this passage?</DialogTitle>
          <DialogDescription>This removes the route, every conditions check and every briefing for {pendingDelete?.passage.name}. It cannot be undone.</DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void remove()} loading={busy}><Trash2 /> Delete passage</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PassageCard({ s, compact, now, utcOffsetMin, onDuplicate, onDelete, busy }: { s: PassageSummary; compact?: boolean; now: number; utcOffsetMin: number | null; onDuplicate: () => void; onDelete: () => void; busy: boolean }) {
  const nav = useNavigate();
  const p = s.passage;
  const href = `/passages/${p.id}`;
  const route = [s.from && s.to ? `${s.from} → ${s.to}` : null, s.vessel?.name ?? null, s.totalNm > 0 ? distancePhrase(s.totalNm) : null].filter(Boolean).join(' · ');
  const departs = p.actual_departure ?? p.planned_departure;
  const headline = s.conditions.length ? riskHeadline(s.conditions, [], s.waypoints, { utcOffsetMin, nowMs: now }) : 'Not checked yet.';
  const depLine = p.status === 'active'
    ? `Departed ${whenPhrase(departs, utcOffsetMin, now)}`
    : p.status === 'planned' ? `Departs ${whenPhrase(departs, utcOffsetMin, now)}${Date.parse(departs) > now ? `, ${whenPhrase(departs, utcOffsetMin, now, 'relative')}` : ''}`
    : `Departed ${whenPhrase(departs, utcOffsetMin, now)}`;
  const menu = (
    <DropdownMenu label={`More for ${p.name}`} items={[
      { label: 'Open', icon: ArrowUpRight, href },
      { label: 'Edit route', icon: Pencil, href: `${href}/edit` },
      { label: 'Duplicate route', icon: Copy, onSelect: onDuplicate, hint: 'Same waypoints and vessel, planned again.', disabled: busy },
      { kind: 'divider' },
      { label: 'Delete', icon: Trash2, onSelect: onDelete, danger: true },
    ]} className="opacity-70 group-hover:opacity-100 focus-within:opacity-100 md:opacity-0" />
  );
  const open = () => nav(href);
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  if (compact) {
    return (
      <article role="link" tabIndex={0} onClick={open} onKeyDown={onKey} className="group card flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-bg-elev focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <RiskDot flag={s.worst} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2"><Link to={href} onClick={(e) => e.stopPropagation()} className="font-medium text-text-1 truncate">{p.name}</Link><span className="t-caption truncate">{route}</span></div>
          <div className="t-caption mt-0.5">{depLine}</div>
        </div>
        {s.confidence && <ConfidenceDot level={s.confidence} withLabel className="hidden sm:inline-flex" />}
        {menu}
      </article>
    );
  }
  return (
    <article role="link" tabIndex={0} onClick={open} onKeyDown={onKey} className={cn('group card p-4 md:p-5 cursor-pointer transition-colors hover:bg-bg-elev focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', p.status === 'active' && 'border-accent/30')}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link to={href} onClick={(e) => e.stopPropagation()} className="text-[16px] font-semibold leading-snug text-text-1 truncate">{p.name}</Link>
            <StatusBadge status={p.status} />
          </div>
          {route && <div className="t-caption mt-1 truncate">{route}</div>}
          <div className="t-caption mt-0.5">{depLine}</div>
        </div>
        {menu}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <RiskDot flag={s.worst} />
          <span className="text-[14px] text-text-1 leading-snug">{headline}</span>
        </div>
        <div className="flex items-center gap-3 t-caption shrink-0">
          {s.confidence ? <ConfidenceDot level={s.confidence} withLabel /> : null}
          {s.runAt && <span>Checked {agePhrase(s.runAt, now)}</span>}
        </div>
      </div>
    </article>
  );
}
