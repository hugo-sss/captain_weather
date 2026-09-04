import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Ship } from 'lucide-react';
import { supabase } from '@/lib/supabase.ts';
import { useVessels } from '@/hooks/useVessels.ts';
import { Button } from '@/components/ui/button.tsx';
import { PageSkeleton } from '@/components/ui/skeleton.tsx';
import { VesselForm } from '@/components/vessel/VesselForm.tsx';
import { fromDraft, toDraft, type VesselDraft } from '@/components/vessel/vesselDraft.ts';
import { ThresholdPreview } from '@/components/vessel/ThresholdPreview.tsx';
import { cn } from '@/lib/utils.ts';

export default function VesselSettings() {
  const { id } = useParams();
  const nav = useNavigate();
  const { vessels, reload, loading } = useVessels();
  const current = useMemo(() => vessels.find((v) => v.id === id) ?? null, [vessels, id]);
  const initial = useMemo(() => (loading ? null : toDraft(id === 'new' ? null : current)), [current, id, loading]);
  const [edited, setEdited] = useState<{ forId: string | undefined; draft: VesselDraft } | null>(null);
  const draft: VesselDraft | null = edited && edited.forId === id ? edited.draft : initial;
  const setDraft = (d: VesselDraft) => setEdited({ forId: id, draft: d });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!draft) return;
    setSaving(true); setError(null);
    const payload = fromDraft(draft);
    const res = current && id !== 'new' ? await supabase.from('vessels').update(payload).eq('id', current.id).select('id').single() : await supabase.from('vessels').insert(payload).select('id').single();
    setSaving(false);
    if (res.error) { setError(res.error.message); return; }
    await reload();
    nav(`/vessels/${res.data.id}`);
  };

  const thresholds = draft ? { max_wind_kn: n(draft.max_wind_kn), max_gust_kn: n(draft.max_gust_kn), max_wave_m: n(draft.max_wave_m), max_current_kn: n(draft.max_current_kn), min_ukc_m: n(draft.min_ukc_m) } : null;
  if (loading) return <PageSkeleton variant="form" />;

  return (
    <div className="p-4 md:p-6 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)] max-w-7xl w-full items-start">
      <aside className="panel p-3 space-y-1">
        <div className="flex items-center justify-between px-1 mb-1"><div className="label">Vessels</div><span className="num text-[11px] text-text-3">{vessels.length}</span></div>
        {vessels.map((v) => (
          <Link key={v.id} to={`/vessels/${v.id}`} className={cn('flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors', v.id === id ? 'bg-bg-2 text-text-1 shadow-[inset_2px_0_0_#2DD4BF]' : 'text-text-2 hover:bg-bg-2/60 hover:text-text-1')}>
            <Ship className={cn('h-4 w-4 shrink-0', v.id === id ? 'text-accent' : 'text-text-3')} />
            <span className="min-w-0 flex-1"><span className="block truncate">{v.name}</span><span className="block text-[11px] text-text-3">{v.vessel_class ?? 'vessel'} · <span className="num">{v.cruise_speed_kn} kn</span></span></span>
          </Link>
        ))}
        {vessels.length === 0 && <p className="px-1 text-xs text-text-3">No vessels yet.</p>}
        <Button asChild variant="secondary" size="sm" className="w-full mt-2"><Link to="/vessels/new"><Plus className="h-3.5 w-3.5" /> New vessel</Link></Button>
      </aside>
      <section className="panel p-4 sm:p-5">
        <div className="mb-4">
          <h1 className="text-[15px] font-semibold leading-tight">{id === 'new' ? 'New vessel' : current?.name ?? 'Select a vessel'}</h1>
          <p className="text-[11px] text-text-3 mt-0.5">Units live in the labels. Thresholds drive the risk flag on every leg.</p>
        </div>
        {draft && (id === 'new' || current) ? <VesselForm key={id} initial={draft} onChange={setDraft} onSave={save} saving={saving} error={error} /> : <div className="gap-hatch rounded-md border border-dashed border-border p-6 text-center text-xs text-text-3">Pick a vessel on the left or create one.</div>}
      </section>
      <section className="panel p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold leading-tight">Live flag preview</h2>
          <p className="text-[11px] text-text-3 mt-0.5">What the current passage's flags would be with the values you are editing. Nothing is saved until you press Save.</p>
        </div>
        {thresholds && <ThresholdPreview vesselId={id && id !== 'new' ? id : null} thresholds={thresholds} draftM={n(draft?.draft_m ?? '')} />}
      </section>
    </div>
  );
}
const n = (v: string): number | null => (v.trim() === '' ? null : Number(v));
