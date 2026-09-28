import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Ship } from 'lucide-react';
import { supabase } from '@/lib/supabase.ts';
import { useVessels } from '@/hooks/useVessels.ts';
import { Button } from '@/components/ui/button.tsx';
import { PageSkeleton } from '@/components/ui/skeleton.tsx';
import { PageHeader } from '@/components/PageHeader.tsx';
import { EmptyState } from '@/components/ui/empty-state.tsx';
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
  const title = id === 'new' ? 'New vessel' : current?.name ?? 'Vessel';

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader width="wide" title={title} description="Cruise speed drives every ETA. Your limits drive the risk flag on every leg."
        actions={id !== 'new' ? <Button variant="secondary" asChild><Link to="/vessels/new"><Plus /> New vessel</Link></Button> : undefined} />
      <div className="px-4 md:px-6 pb-8 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,420px)] max-w-[1280px] w-full mx-auto items-start">
        <aside className="card p-2 space-y-0.5">
          <div className="label px-2 pt-1.5 pb-1.5">Vessels</div>
          {vessels.map((v) => (
            <Link key={v.id} to={`/vessels/${v.id}`} className={cn('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] transition-colors', v.id === id ? 'bg-bg-2 text-text-1' : 'text-text-2 hover:bg-bg-2/60 hover:text-text-1')}>
              <Ship className={cn('h-4 w-4 shrink-0', v.id === id ? 'text-accent' : 'text-text-3')} />
              <span className="min-w-0 flex-1"><span className="block truncate">{v.name}</span><span className="block t-caption">{v.vessel_class ?? 'vessel'}, <span className="num">{v.cruise_speed_kn} kn</span></span></span>
            </Link>
          ))}
          {vessels.length === 0 && <p className="px-2.5 py-2 t-caption">No vessels yet.</p>}
        </aside>
        <section className="card p-5 md:p-6">
          {draft && (id === 'new' || current) ? <VesselForm key={id} initial={draft} onChange={setDraft} onSave={save} saving={saving} error={error} /> : <EmptyState compact icon={Ship} title="Pick a vessel" body="Choose one on the left, or add a new one." action={<Button asChild><Link to="/vessels/new"><Plus /> New vessel</Link></Button>} className="shadow-none border-0" />}
        </section>
        <section className="card p-5 md:p-6">
          <div className="mb-4">
            <h2 className="t-section">What this changes on your current passage</h2>
            <p className="t-caption mt-0.5">Flags recomputed with the limits you are editing. Nothing is saved until you press Save.</p>
          </div>
          {thresholds && <ThresholdPreview vesselId={id && id !== 'new' ? id : null} thresholds={thresholds} draftM={n(draft?.draft_m ?? '')} />}
        </section>
      </div>
    </div>
  );
}
const n = (v: string): number | null => (v.trim() === '' ? null : Number(v));
