// Sticky header of the one passage page: back link, title, one meta line, status pill, the
// Simple | Detailed control, ONE primary button that depends on state, and an overflow menu.
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { DetailLevel, PassageRow, VesselRow } from '@/types/domain.ts';
import { StatusBadge } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Segmented } from '@/components/ui/segmented.tsx';
import { DropdownMenu, type MenuItem } from '@/components/ui/dropdown-menu.tsx';
import { distancePhrase, localDateTime } from '@/lib/plain.ts';
import { fmtUtc } from '@/lib/time.ts';

type Props = {
  passage: PassageRow; vessel: VesselRow | null; from: string | null; to: string | null; totalNm: number;
  utcOffsetMin: number | null; detail: DetailLevel; onDetail: (d: DetailLevel) => void;
  primary: { label: string; onClick: () => void; busy: boolean };
  menu: MenuItem[];
};

export function PassageHeader({ passage, vessel, from, to, totalNm, utcOffsetMin, detail, onDetail, primary, menu }: Props) {
  const departs = passage.actual_departure ?? passage.planned_departure;
  const when = localDateTime(departs, utcOffsetMin);
  const meta = [vessel?.name ?? null, from && to ? `${from} to ${to}` : null, totalNm > 0 ? distancePhrase(totalNm) : null, when ? `${passage.actual_departure ? 'departed' : 'departs'} ${when} local` : null].filter(Boolean);
  const seg = <Segmented<DetailLevel> label="Detail level" value={detail} onChange={onDetail} size="sm" options={[{ value: 'simple', label: 'Simple' }, { value: 'detailed', label: 'Detailed' }]} />;
  return (
    <div className="sticky top-0 z-[900] border-b border-border-soft bg-bg-1/95 backdrop-blur-sm px-4 md:px-6 pt-3 pb-3">
      <Link to="/passages" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-2 hover:text-text-1"><ArrowLeft className="h-3.5 w-3.5" /> Passages</Link>
      <div className="mt-1 flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="t-page truncate max-w-full">{passage.name}</h1>
            <StatusBadge status={passage.status} />
          </div>
          <p className="t-caption mt-1 truncate" title={when ? `${fmtUtc(departs)} UTC` : undefined}>{meta.join(' · ')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden md:inline-flex">{seg}</span>
          <Button onClick={primary.onClick} loading={primary.busy} className="min-w-[150px]">{primary.busy ? 'Checking…' : primary.label}</Button>
          <DropdownMenu label="More actions" items={menu} />
        </div>
      </div>
      <div className="mt-3 md:hidden">{seg}</div>
    </div>
  );
}
