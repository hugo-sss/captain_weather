// /settings: display preferences. These change how things are shown, never which data is reachable.
import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.ts';
import { useDisplayPrefs } from '@/hooks/useDisplayPrefs.ts';
import { PageHeader } from '@/components/PageHeader.tsx';
import { Section } from '@/components/ui/section.tsx';
import { Segmented } from '@/components/ui/segmented.tsx';
import { Select } from '@/components/ui/select.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Label } from '@/components/ui/label.tsx';
import { fmtOffset } from '@/lib/time.ts';
import type { DetailLevel } from '@/types/domain.ts';

const OFFSETS: number[] = [];
for (let m = -12 * 60; m <= 14 * 60; m += 30) OFFSETS.push(m);

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3.5 border-b border-border-soft last:border-0">
      <div className="min-w-0"><div className="text-[14px] font-medium">{label}</div>{hint && <div className="t-caption mt-0.5">{hint}</div>}</div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function Settings() {
  const { prefs, update } = useDisplayPrefs();
  const { user, signOut } = useAuth();
  const browserOff = -new Date().getTimezoneOffset();
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader title="Settings" description="Changes apply straight away on this device." />
      <div className="px-4 md:px-6 pb-8 max-w-3xl w-full space-y-8">
        <Section title="Time" description="Times on passage pages are shown in this local time. UTC stays available in tooltips and in Detailed mode.">
          <div className="card px-5">
            <Row label="Local time zone" hint={`Browser local is ${fmtOffset(browserOff)} right now.`}>
              <Select value={prefs.local_utc_offset_min === null ? '' : String(prefs.local_utc_offset_min)} onChange={(e) => update({ local_utc_offset_min: e.target.value === '' ? null : Number(e.target.value) })} className="w-56" aria-label="Local time zone">
                <option value="">Browser local ({fmtOffset(browserOff)})</option>
                {OFFSETS.map((m) => <option key={m} value={m}>{fmtOffset(m)}</option>)}
              </Select>
            </Row>
          </div>
        </Section>
        <Section title="Passage page" description="Simple shows plain sentences and the numbers that matter. Detailed adds every field, model ids and UTC times. The full table is always one tap away.">
          <div className="card px-5">
            <Row label="Default detail level">
              <Segmented<DetailLevel> label="Detail level" value={prefs.detail_level} onChange={(v) => update({ detail_level: v })} options={[{ value: 'simple', label: 'Simple' }, { value: 'detailed', label: 'Detailed' }]} />
            </Row>
          </div>
        </Section>
        <Section title="Map overlays" description="Chart overlays are a planning aid, not a substitute for official charts.">
          <div className="card px-5">
            <Row label="OpenSeaMap seamarks" hint="Crowdsourced, not official.">
              <Switch checked={prefs.show_openseamap} onCheckedChange={(v) => update({ show_openseamap: v })} aria-label="OpenSeaMap overlay" />
            </Row>
            <Row label="NOAA ENC features" hint="US waters only. Not for navigation.">
              <Switch checked={prefs.show_noaa_enc} onCheckedChange={(v) => update({ show_noaa_enc: v })} aria-label="NOAA ENC overlay" />
            </Row>
          </div>
        </Section>
        <Section title="Account">
          <div className="card px-5">
            <Row label="Signed in as" hint={user?.email ?? undefined}>
              <Button variant="secondary" size="sm" onClick={() => void signOut()}><LogOut /> Sign out</Button>
            </Row>
          </div>
        </Section>
        <div>
          <Label>Hidden</Label>
          <p className="t-caption">Nothing here hides data. Every number remains reachable on the full table page of each passage.</p>
        </div>
      </div>
    </div>
  );
}
