// Notification helpers (pure). The inbox lives in `notifications`, owner-only via RLS; read state is `read_at`.
import type { NotificationKind, NotificationRow } from '@/types/domain.ts';
import type { MaterialChange } from '../../supabase/functions/_shared/material-changes.ts';

export const isUnread = (n: Pick<NotificationRow, 'read_at'>) => n.read_at === null || n.read_at === undefined;

export function unreadCount(rows: Pick<NotificationRow, 'read_at'>[]): number {
  return rows.reduce((n, r) => n + (isUnread(r) ? 1 : 0), 0);
}

/** Newest first, `limit` at most. */
export function latest<T extends Pick<NotificationRow, 'created_at'>>(rows: T[], limit = 10): T[] {
  return [...rows].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, limit);
}

/** The unread material_change notifications for one passage, newest first. */
export function unreadMaterialChangesFor(rows: NotificationRow[], passageId: string | null | undefined): NotificationRow[] {
  if (!passageId) return [];
  return latest(rows.filter((r) => r.passage_id === passageId && r.kind === 'material_change' && isUnread(r)), rows.length);
}

export function changesFromPayload(payload: unknown): MaterialChange[] {
  const p = payload as { changes?: unknown } | null;
  return Array.isArray(p?.changes) ? (p!.changes as MaterialChange[]) : [];
}

export const KIND_LABEL: Record<NotificationKind, string> = { material_change: 'Material change', recheck: 'Re-check', recheck_failed: 'Re-check failed', briefing: 'Briefing' };

export const asKind = (v: string): NotificationKind => (v === 'material_change' || v === 'recheck' || v === 'recheck_failed' || v === 'briefing' ? v : 'recheck');

/** "3 min ago", "2 h ago", "4 d ago", stable for tests via `now`. */
export function relativeTime(iso: string, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

/** Where a click lands: material changes and briefings open the passage table; re-checks open the monitor. */
export function notificationHref(n: Pick<NotificationRow, 'passage_id' | 'kind'>): string | null {
  if (!n.passage_id) return null;
  const kind = asKind(n.kind);
  if (kind === 'recheck' || kind === 'recheck_failed') return `/passages/${n.passage_id}/active`;
  return `/passages/${n.passage_id}`;
}
