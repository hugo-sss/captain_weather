// /notifications: the full inbox. Same rows as the bell, no cap, grouped unread first.
import { Bell, CheckCheck } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications.ts';
import { useNow } from '@/hooks/useNow.ts';
import { isUnread, latest } from '@/lib/notifications.ts';
import { NotificationItem } from '@/components/notifications/NotificationItem.tsx';
import { PageHeader } from '@/components/PageHeader.tsx';
import { Button } from '@/components/ui/button.tsx';
import { PageSkeleton } from '@/components/ui/skeleton.tsx';

export default function Notifications() {
  const { notifications, unread, loaded, error, markRead, markAllRead } = useNotifications();
  const now = useNow(30_000);
  if (!loaded) return <PageSkeleton variant="list" />;
  const rows = latest(notifications, notifications.length);
  const unreadRows = rows.filter(isUnread), readRows = rows.filter((r) => !isUnread(r));
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader title={<span className="inline-flex items-center gap-2"><Bell className="h-4 w-4 text-accent" /> Notifications</span>} meta={<span><span className="num text-text-2">{unread}</span> unread · <span className="num text-text-2">{rows.length}</span> total · polled every 60 s while this tab is visible</span>}
        actions={<Button size="sm" variant="secondary" onClick={() => void markAllRead()} disabled={unread === 0}><CheckCheck className="h-3.5 w-3.5" /> Mark all read</Button>} />
      <div className="p-4 max-w-3xl w-full space-y-4">
        {error && <p className="text-xs text-risk-red">{error}</p>}
        {rows.length === 0 && <div className="panel p-6 gap-hatch border-dashed text-sm text-text-2 text-center">No notifications yet. Scheduled re-checks that find material changes, failed re-checks and new briefings land here.</div>}
        {unreadRows.length > 0 && <section className="panel p-1"><div className="label px-2 pt-2 pb-1">Unread</div>{unreadRows.map((n) => <NotificationItem key={n.id} n={n} now={now} onOpen={(x) => void markRead([x.id])} />)}</section>}
        {readRows.length > 0 && <section className="panel p-1"><div className="label px-2 pt-2 pb-1">Earlier</div>{readRows.map((n) => <NotificationItem key={n.id} n={n} now={now} onOpen={() => undefined} />)}</section>}
      </div>
    </div>
  );
}
