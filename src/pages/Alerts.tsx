// /alerts: the full inbox, grouped by day. Same cards as the bell, no cap.
import { useMemo } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications.ts';
import { useNow } from '@/hooks/useNow.ts';
import { useDisplayPrefs } from '@/hooks/useDisplayPrefs.ts';
import { latest } from '@/lib/notifications.ts';
import { localDateTime } from '@/lib/plain.ts';
import { AlertCard } from '@/components/notifications/AlertCard.tsx';
import { PageHeader } from '@/components/PageHeader.tsx';
import { Button } from '@/components/ui/button.tsx';
import { EmptyState } from '@/components/ui/empty-state.tsx';
import { PageSkeleton } from '@/components/ui/skeleton.tsx';
import type { NotificationRow } from '@/types/domain.ts';

function dayKey(iso: string, offsetMin: number | null): number {
  const off = offsetMin ?? -new Date().getTimezoneOffset();
  return Math.floor((Date.parse(iso) + off * 60_000) / 86_400_000);
}

export default function Alerts() {
  const { notifications, unread, loaded, error, markRead, markAllRead } = useNotifications();
  const { prefs } = useDisplayPrefs();
  const now = useNow(30_000);
  const groups = useMemo(() => {
    const rows = latest(notifications, notifications.length);
    const today = dayKey(new Date(now).toISOString(), prefs.local_utc_offset_min);
    const out: { key: number; title: string; rows: NotificationRow[] }[] = [];
    for (const r of rows) {
      const k = dayKey(r.created_at, prefs.local_utc_offset_min);
      let g = out.find((x) => x.key === k);
      if (!g) {
        const title = k === today ? 'Today' : k === today - 1 ? 'Yesterday' : (localDateTime(r.created_at, prefs.local_utc_offset_min) ?? '').replace(/,.*$/, '');
        g = { key: k, title, rows: [] }; out.push(g);
      }
      g.rows.push(r);
    }
    return out;
  }, [notifications, now, prefs.local_utc_offset_min]);
  if (!loaded) return <PageSkeleton variant="list" />;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader title="Alerts" description={<span>{unread === 0 ? 'All read' : `${unread} unread`}. Checks that find changes, failed checks and new briefings land here.</span>}
        actions={<Button variant="secondary" onClick={() => void markAllRead()} disabled={unread === 0}><CheckCheck /> Mark all read</Button>} />
      <div className="px-4 md:px-6 pb-8 max-w-3xl w-full space-y-6">
        {error && <p className="text-[12px] text-risk-red">{error}</p>}
        {notifications.length === 0 && <EmptyState icon={Bell} title="No alerts yet" body="Scheduled checks that find material changes, failed checks and new briefings land here." />}
        {groups.map((g) => (
          <section key={g.key} aria-label={g.title}>
            <h2 className="t-section mb-3">{g.title}</h2>
            <div className="space-y-2">{g.rows.map((n) => <AlertCard key={n.id} n={n} now={now} onOpen={(x) => void markRead([x.id])} />)}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
