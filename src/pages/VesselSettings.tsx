import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase.ts';
import { useVessels } from '@/hooks/useVessels.ts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Button } from '@/components/ui/button.tsx';
import { VesselForm } from '@/components/vessel/VesselForm.tsx';
import { fromDraft, toDraft, type VesselDraft } from '@/components/vessel/vesselDraft.ts';
import { ThresholdPreview } from '@/components/vessel/ThresholdPreview.tsx';

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

  return (
    <div className="p-4 grid gap-4 lg:grid-cols-[280px_1fr_1fr] max-w-6xl">
      <Card>
        <CardHeader><CardTitle>Vessels</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {vessels.map((v) => <Link key={v.id} to={`/vessels/${v.id}`} className={`block rounded-md px-2 py-1.5 text-sm ${v.id === id ? 'bg-bg-2' : 'hover:bg-bg-2/60'}`}>{v.name} <span className="text-text-3 text-xs num">{v.cruise_speed_kn} kn</span></Link>)}
          {vessels.length === 0 && !loading && <p className="text-xs text-text-3">No vessels yet.</p>}
          <Button asChild variant="secondary" size="sm" className="mt-2"><Link to="/vessels/new">New vessel</Link></Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{id === 'new' ? 'New vessel' : current?.name ?? 'Select a vessel'}</CardTitle></CardHeader>
        <CardContent>
          {draft && (id === 'new' || current) ? <VesselForm key={id} initial={draft} onChange={setDraft} onSave={save} saving={saving} error={error} /> : <p className="text-xs text-text-3">Pick a vessel on the left or create one.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Threshold preview</CardTitle></CardHeader>
        <CardContent>{thresholds && <ThresholdPreview vesselId={id && id !== 'new' ? id : null} thresholds={thresholds} draftM={n(draft?.draft_m ?? '')} />}</CardContent>
      </Card>
    </div>
  );
}
const n = (v: string): number | null => (v.trim() === '' ? null : Number(v));
