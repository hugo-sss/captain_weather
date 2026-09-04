// Dev-only stand-in for '@/lib/supabase.ts'. Activated by the PREVIEW_MOCK=1 Vite alias (see vite.config.ts)
// so the real pages and hooks render unchanged against the fixtures. Never part of a production build.
import { buildDb, USER_EMAIL, type FixtureDb, type Row } from './fixtures.ts';

type Filter = (r: Row) => boolean;
type Result<T> = { data: T; error: { message: string } | null };

const db: FixtureDb = buildDb();
let seq = 1000;
const same = (a: unknown, b: unknown) => a === b || String(a) === String(b);
const cmpVal = (a: unknown, b: unknown) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b)));

class Query<T = Row[]> implements PromiseLike<Result<T>> {
  private filters: Filter[] = [];
  private orderBy: { key: string; asc: boolean } | null = null;
  private max: number | null = null;
  private shape: 'many' | 'maybeSingle' | 'single' = 'many';
  private mode: 'select' | 'update' | 'insert' | 'upsert' | 'delete' = 'select';
  private payload: Row | Row[] | null = null;
  constructor(private table: string) {}

  select(_cols?: string) { void _cols; return this as unknown as Query<T>; }
  eq(k: string, v: unknown) { this.filters.push((r) => same(r[k], v)); return this; }
  neq(k: string, v: unknown) { this.filters.push((r) => !same(r[k], v)); return this; }
  in(k: string, vs: unknown[]) { this.filters.push((r) => vs.some((v) => same(r[k], v))); return this; }
  is(k: string, v: unknown) { this.filters.push((r) => (v === null ? r[k] === null || r[k] === undefined : same(r[k], v))); return this; }
  gte(k: string, v: unknown) { this.filters.push((r) => cmpVal(r[k], v) >= 0); return this; }
  lte(k: string, v: unknown) { this.filters.push((r) => cmpVal(r[k], v) <= 0); return this; }
  gt(k: string, v: unknown) { this.filters.push((r) => cmpVal(r[k], v) > 0); return this; }
  lt(k: string, v: unknown) { this.filters.push((r) => cmpVal(r[k], v) < 0); return this; }
  order(k: string, o?: { ascending?: boolean }) { this.orderBy = { key: k, asc: o?.ascending ?? true }; return this; }
  limit(n: number) { this.max = n; return this; }
  maybeSingle() { this.shape = 'maybeSingle'; return this as unknown as Query<Row | null>; }
  single() { this.shape = 'single'; return this as unknown as Query<Row>; }
  update(patch: Row) { this.mode = 'update'; this.payload = patch; return this; }
  insert(rows: Row | Row[]) { this.mode = 'insert'; this.payload = rows; return this; }
  upsert(rows: Row | Row[], _o?: unknown) { void _o; this.mode = 'upsert'; this.payload = rows; return this; }
  delete() { this.mode = 'delete'; return this; }

  private exec(): Result<unknown> {
    const rows = db[this.table] ?? (db[this.table] = []);
    const match = (r: Row) => this.filters.every((f) => f(r));
    let out: Row[];
    if (this.mode === 'update') {
      out = rows.filter(match);
      for (const r of out) Object.assign(r, this.payload as Row, { updated_at: new Date().toISOString() });
    } else if (this.mode === 'delete') {
      out = rows.filter(match);
      db[this.table] = rows.filter((r) => !match(r));
    } else if (this.mode === 'insert' || this.mode === 'upsert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      out = list.map((p) => {
        const existing = this.mode === 'upsert' && p.id !== undefined ? rows.find((r) => same(r.id, p.id)) : undefined;
        if (existing) { Object.assign(existing, p); return existing; }
        const row = { id: `${this.table}-${++seq}`, created_at: new Date().toISOString(), ...p };
        rows.push(row); return row;
      });
    } else {
      out = rows.filter(match);
    }
    if (this.orderBy) { const { key, asc } = this.orderBy; out = [...out].sort((a, b) => cmpVal(a[key], b[key]) * (asc ? 1 : -1)); }
    if (this.max !== null) out = out.slice(0, this.max);
    if (this.shape === 'maybeSingle') return { data: out[0] ?? null, error: null };
    if (this.shape === 'single') return out[0] ? { data: out[0], error: null } : { data: null, error: { message: 'no rows' } };
    return { data: out, error: null };
  }

  then<R1 = Result<T>, R2 = never>(onOk?: ((v: Result<T>) => R1 | PromiseLike<R1>) | null, onErr?: ((e: unknown) => R2 | PromiseLike<R2>) | null): PromiseLike<R1 | R2> {
    return new Promise<Result<T>>((res) => setTimeout(() => res(this.exec() as Result<T>), 8)).then(onOk ?? undefined, onErr ?? undefined);
  }
}

const session = { user: { id: 'user-captain', email: USER_EMAIL }, access_token: 'preview' };

const client = {
  from: (table: string) => new Query(table),
  rpc: async (name: string) => (name === 'chart_features_geojson' ? { data: { type: 'FeatureCollection', features: [] }, error: null } : { data: null, error: null }),
  auth: {
    getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    signOut: async () => ({ error: null }),
    signInWithOtp: async () => ({ data: {}, error: null }),
    verifyOtp: async () => ({ data: {}, error: null }),
  },
  functions: { invoke: async (name: string) => { await new Promise((r) => setTimeout(r, 700)); return { data: name === 'compute-conditions' ? { run_id: 'run-2' } : {}, error: null }; } },
};

export const supabaseConfigured = true;
export const supabase = client as unknown as typeof import('@/lib/supabase.ts')['supabase'];
export type FunctionName = 'plan-targets' | 'ingest-tick' | 'compute-conditions' | 'generate-briefing';
export async function invokeFunction<T = unknown>(name: FunctionName, body: Record<string, unknown>): Promise<T> {
  void body;
  const { data } = await client.functions.invoke(name);
  return data as T;
}
