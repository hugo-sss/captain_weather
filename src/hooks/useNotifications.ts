// In-app inbox. One shared store for the bell, the /notifications page and passage banners: the first
// mounted consumer starts a 60 s poll (only while the tab is visible) and a refresh on focus; the last
// one stops it. RLS limits rows to the owner; marking read is an update of read_at.
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase.ts';
import type { NotificationRow } from '@/types/domain.ts';
import { unreadCount } from '@/lib/notifications.ts';

const POLL_MS = 60_000;
const PAGE = 200;

type Store = { rows: NotificationRow[]; loaded: boolean; error: string | null };
let store: Store = { rows: [], loaded: false, error: null };
const listeners = new Set<(s: Store) => void>();
let consumers = 0;
let timer: number | null = null;
let inflight: Promise<void> | null = null;

const emit = () => { for (const l of listeners) l(store); };
const set = (patch: Partial<Store>) => { store = { ...store, ...patch }; emit(); };

/** Query: notifications order by created_at desc limit 200. */
export async function refreshNotifications(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(PAGE);
    if (error) set({ error: error.message, loaded: true });
    else set({ rows: data ?? [], error: null, loaded: true });
  })().finally(() => { inflight = null; });
  return inflight;
}

function tick() { if (document.visibilityState === 'visible') void refreshNotifications(); }
function start() {
  if (timer !== null) return;
  void refreshNotifications();
  timer = window.setInterval(tick, POLL_MS);
  window.addEventListener('focus', tick);
  document.addEventListener('visibilitychange', tick);
}
function stop() {
  if (timer === null) return;
  window.clearInterval(timer); timer = null;
  window.removeEventListener('focus', tick);
  document.removeEventListener('visibilitychange', tick);
}

/** Mark specific rows read: update notifications set read_at = now() where id in (...). Optimistic. */
export async function markRead(ids: string[]): Promise<void> {
  const targets = ids.filter((id) => store.rows.some((r) => r.id === id && r.read_at === null));
  if (!targets.length) return;
  const now = new Date().toISOString();
  set({ rows: store.rows.map((r) => (targets.includes(r.id) ? { ...r, read_at: now } : r)) });
  const { error } = await supabase.from('notifications').update({ read_at: now }).in('id', targets);
  if (error) void refreshNotifications();
}

export async function markAllRead(): Promise<void> {
  return markRead(store.rows.filter((r) => r.read_at === null).map((r) => r.id));
}

const subscribe = (l: (s: Store) => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => store;

export function useNotifications() {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => { consumers += 1; start(); return () => { consumers -= 1; if (consumers === 0) stop(); }; }, []);
  const refresh = useCallback(() => refreshNotifications(), []);
  return { notifications: s.rows, unread: unreadCount(s.rows), loaded: s.loaded, error: s.error, refresh, markRead, markAllRead };
}

/** Test seam. */
export function _resetNotificationStore() { stop(); store = { rows: [], loaded: false, error: null }; consumers = 0; }
