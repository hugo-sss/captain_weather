// UTC plus local offset everywhere numbers are shown (PRD §8.5 unit conventions).
export function fmtUtc(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toISOString().slice(5, 10).replace('-', '/')} ${d.toISOString().slice(11, 16)}Z`;
}

export function fmtLocal(iso: string | null | undefined, offsetMin: number | null = null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const off = offsetMin ?? -d.getTimezoneOffset();
  const local = new Date(d.getTime() + off * 60_000);
  const sign = off >= 0 ? '+' : '−';
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0');
  const mm = Math.abs(off) % 60;
  return `${local.toISOString().slice(11, 16)} (UTC${sign}${hh}${mm ? ':' + String(mm).padStart(2, '0') : ''})`;
}

export function fmtHours(h: number | null | undefined): string {
  if (h === null || h === undefined || !Number.isFinite(h)) return '—';
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${hh}h ${String(mm).padStart(2, '0')}m`;
}

export function ageMinutes(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.round((Date.now() - Date.parse(iso)) / 60_000);
}

export function fmtAge(iso: string | null | undefined): string {
  const m = ageMinutes(iso);
  if (m === null) return 'never';
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

export const toLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
export const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);

/** "UTC+07" / "UTC−03:30" for a minutes offset. */
export function fmtOffset(offsetMin: number): string {
  const sign = offsetMin >= 0 ? '+' : '−';
  const hh = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0'), mm = Math.abs(offsetMin) % 60;
  return `UTC${sign}${hh}${mm ? ':' + String(mm).padStart(2, '0') : ''}`;
}
