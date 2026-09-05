// Gust provenance chips. Estimated gusts (no gust field in the primary ensemble) are muted and explained.
export type GustSourceChip = { label: string; estimated: boolean; title: string };

export const ESTIMATED_GUST_NOTE = 'no gust in the primary ensemble; estimated from p90 wind';

const KNOWN: Record<string, string> = {
  google_weathernext2_ensemble: 'WN2',
  ecmwf_ifs025_ensemble: 'ECMWF ENS',
  ecmwf_ifs025: 'ECMWF',
  ncep_gfs_global: 'GFS',
  gfs_seamless: 'GFS',
};

export function gustSourceChip(source: string | null | undefined): GustSourceChip | null {
  if (!source) return null;
  const est = /^estimated(?:_x?([\d.]+))?$/i.exec(source);
  if (est) return { label: `est ×${est[1] ?? '1.3'}`, estimated: true, title: ESTIMATED_GUST_NOTE };
  const label = KNOWN[source] ?? source.replace(/_/g, ' ').toUpperCase().slice(0, 12);
  return { label, estimated: false, title: `gust p90 from ${source}` };
}
