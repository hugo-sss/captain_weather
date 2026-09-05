import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { usePassage } from '@/hooks/usePassage.ts';
import { useVessels } from '@/hooks/useVessels.ts';
import { useDisplayPrefs } from '@/hooks/useDisplayPrefs.ts';
import type { PassageRow, VesselRow, WaypointRow } from '@/types/domain.ts';
import { PassageMap } from '@/components/map/PassageMap.tsx';
import { DisclaimerBar } from '@/components/map/DisclaimerBar.tsx';
import { BuilderPanel } from '@/components/builder/BuilderPanel.tsx';
import { useBuilderDraft } from '@/components/builder/useBuilderDraft.ts';
import { Switch } from '@/components/ui/switch.tsx';
import { PageSkeleton } from '@/components/ui/skeleton.tsx';

export default function PassageBuilder() {
  const { id } = useParams();
  const { data, loading } = usePassage(id);
  const { vessels } = useVessels();
  if (id && loading) return <PageSkeleton variant="map" />;
  if (id && !data) return <div className="p-6 text-sm text-text-2">Passage not found.</div>;
  // Key on the passage id so the form's own state initialises from the loaded rows exactly once per passage.
  return <BuilderForm key={id ?? 'new'} id={id} passage={data?.passage ?? null} waypoints={data?.waypoints ?? []} vessels={vessels} />;
}

function BuilderForm({ id, passage, waypoints, vessels }: { id: string | undefined; passage: PassageRow | null; waypoints: WaypointRow[]; vessels: VesselRow[] }) {
  const nav = useNavigate();
  const { prefs, update } = useDisplayPrefs();
  const draft = useBuilderDraft({ id, passage, waypoints, vessels });
  const { withEta, preview, selectedKey, setSelectedKey, setSheetKey, addPin, movePin } = draft;
  const dest = withEta[withEta.length - 1];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <DisclaimerBar />
      <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_400px]">
        <div className="relative min-h-[40vh] lg:min-h-[420px]">
          <PassageMap waypoints={withEta.map((w) => ({ id: w.key, sequence: w.sequence, name: w.name, lat: w.lat, lon: w.lon, is_anchorage: w.is_anchorage }))} editable selectedId={selectedKey} showOpenSeaMap={prefs.show_openseamap} onAddPin={addPin} onMovePin={movePin} onSelect={(k) => { setSelectedKey(k); setSheetKey(k); }} />
          <label className="absolute top-2 right-2 z-[1000] rounded-md border border-border bg-bg-1/92 backdrop-blur-sm px-2.5 py-1.5 text-[11px] flex items-center gap-3 cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.35)]"><span>OpenSeaMap <span className="text-text-3">crowdsourced, not official</span></span><Switch checked={prefs.show_openseamap} onCheckedChange={(v) => update({ show_openseamap: v })} aria-label="OpenSeaMap overlay" /></label>
          <div className="absolute bottom-2 left-2 z-[1000] rounded-md border border-border bg-bg-1/92 backdrop-blur-sm px-2.5 py-1.5 text-[11px] text-text-2 flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-accent" /> Click the map to drop a pin. Drag pins to move them.</div>
          {withEta.length >= 2 && (
            <div className="absolute bottom-2 right-2 z-[1000] rounded-md border border-border bg-bg-1/92 backdrop-blur-sm px-3 py-1.5 text-[12px] flex items-center gap-2 max-w-[60%]">
              <span className="truncate font-medium">{withEta[0].name || 'WP1'}</span><ArrowRight className="h-3.5 w-3.5 text-text-3 shrink-0" /><span className="truncate font-medium">{dest.name || `WP${dest.sequence}`}</span>
              {preview && <span className="num text-text-3 shrink-0 ml-1">{preview.totalDistanceNm.toFixed(1)} nm</span>}
            </div>
          )}
        </div>
        <aside className="border-l border-border bg-bg-1 flex flex-col min-h-0">
          <BuilderPanel draft={draft} vessels={vessels} id={id} onSaved={(pid) => nav(`/passages/${pid}`)} className="flex-1 min-h-0" />
        </aside>
      </div>
    </div>
  );
}
