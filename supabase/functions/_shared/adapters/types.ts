import type { AdapterEnv, AdapterResult, FetchRange, IngestTarget } from '../contracts.ts';

export type Adapter<Row> = (target: IngestTarget, range: FetchRange, env: AdapterEnv) => Promise<AdapterResult<Row>>;

export type OpenMeteoHourly = { time: string[] } & Record<string, (number | null)[] | string[]>;
export type OpenMeteoResponse = {
  latitude: number; longitude: number; utc_offset_seconds: number;
  hourly?: OpenMeteoHourly; hourly_units?: Record<string, string>;
  error?: boolean; reason?: string;
};

export const nn = (v: number | null | undefined): number | null => (v === null || v === undefined || !Number.isFinite(v) ? null : v);
export const round = (v: number | null, dp: number): number | null => (v === null ? null : Math.round(v * 10 ** dp) / 10 ** dp);

/** Open-Meteo hourly `time` values are "YYYY-MM-DDTHH:MM" in the requested timezone (UTC here). */
export const omTimeToIso = (t: string): string => (t.endsWith('Z') ? t : `${t}:00Z`).replace(/(\d{2}:\d{2}):00Z$/, '$1:00Z');

export function withinRange(iso: string, range: FetchRange): boolean {
  const t = Date.parse(iso);
  return t >= Date.parse(range.start) && t <= Date.parse(range.end);
}

export async function getJson(env: AdapterEnv, url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const res = await env.fetch(url, init);
  const body: unknown = await res.json().catch(() => null);
  return { status: res.status, body };
}
