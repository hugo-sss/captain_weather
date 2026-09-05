import { describe, expect, it } from 'vitest';
import { changesFromPayload, latest, notificationHref, relativeTime, unreadCount, unreadMaterialChangesFor } from '../src/lib/notifications.ts';
import { gustSourceChip } from '../src/lib/gust-source.ts';
import type { NotificationRow } from '../src/types/domain.ts';

const n = (o: Partial<NotificationRow>): NotificationRow => ({ id: 'x', owner_id: 'u', passage_id: 'p1', run_id: null, briefing_id: null, kind: 'recheck', title: 't', body: 'b', payload: {}, created_at: '2026-09-05T00:00:00Z', read_at: null, emailed_at: null, ...o });

describe('notification unread counting', () => {
  it('counts rows with no read_at', () => {
    expect(unreadCount([n({ id: 'a' }), n({ id: 'b', read_at: '2026-09-05T01:00:00Z' }), n({ id: 'c' })])).toBe(2);
    expect(unreadCount([])).toBe(0);
  });
  it('unread material changes for a passage, newest first, ignore other passages, kinds and read rows', () => {
    const rows = [
      n({ id: 'old', kind: 'material_change', created_at: '2026-09-01T00:00:00Z' }),
      n({ id: 'new', kind: 'material_change', created_at: '2026-09-05T00:00:00Z' }),
      n({ id: 'read', kind: 'material_change', read_at: '2026-09-05T00:00:00Z' }),
      n({ id: 'other', kind: 'material_change', passage_id: 'p2' }),
      n({ id: 'brief', kind: 'briefing' }),
    ];
    expect(unreadMaterialChangesFor(rows, 'p1').map((r) => r.id)).toEqual(['new', 'old']);
    expect(unreadMaterialChangesFor(rows, null)).toEqual([]);
  });
  it('latest N newest first; payload changes parsed defensively', () => {
    const rows = [n({ id: 'a', created_at: '2026-09-01T00:00:00Z' }), n({ id: 'b', created_at: '2026-09-03T00:00:00Z' }), n({ id: 'c', created_at: '2026-09-02T00:00:00Z' })];
    expect(latest(rows, 2).map((r) => r.id)).toEqual(['b', 'c']);
    expect(changesFromPayload({ changes: [{ waypoint_id: 'w', field: 'risk_flag', from: 'green', to: 'red' }] })).toHaveLength(1);
    expect(changesFromPayload({})).toEqual([]);
    expect(changesFromPayload(null)).toEqual([]);
  });
  it('relative time and click targets', () => {
    const now = Date.parse('2026-09-05T12:00:00Z');
    expect(relativeTime('2026-09-05T11:59:40Z', now)).toBe('just now');
    expect(relativeTime('2026-09-05T11:15:00Z', now)).toBe('45 min ago');
    expect(relativeTime('2026-09-05T02:00:00Z', now)).toBe('10 h ago');
    expect(relativeTime('2026-09-01T12:00:00Z', now)).toBe('4 d ago');
    expect(notificationHref(n({ kind: 'material_change' }))).toBe('/passages/p1');
    expect(notificationHref(n({ kind: 'recheck_failed' }))).toBe('/passages/p1/active');
    expect(notificationHref(n({ passage_id: null }))).toBeNull();
  });
});

describe('gust provenance chips', () => {
  it('labels the known sources and marks estimated gusts', () => {
    expect(gustSourceChip('google_weathernext2_ensemble')).toMatchObject({ label: 'WN2', estimated: false });
    expect(gustSourceChip('ecmwf_ifs025_ensemble')).toMatchObject({ label: 'ECMWF ENS', estimated: false });
    expect(gustSourceChip('ncep_gfs_global')).toMatchObject({ label: 'GFS', estimated: false });
    expect(gustSourceChip('estimated_x1.3')).toMatchObject({ label: 'est ×1.3', estimated: true });
    expect(gustSourceChip('estimated')).toMatchObject({ label: 'est ×1.3', estimated: true });
    expect(gustSourceChip(null)).toBeNull();
  });
});
