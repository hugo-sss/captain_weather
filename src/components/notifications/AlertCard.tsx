// One alert: kind icon, title, the change lines, when, and "Open passage". Shared by the bell and /alerts.
import { Link } from 'react-router-dom';
import { ArrowUpRight, CircleX, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
import type { NotificationRow } from '@/types/domain.ts';
import { asKind, changesFromPayload, isUnread, notificationHref, relativeTime } from '@/lib/notifications.ts';
import { changeLine } from '@/lib/material-changes-text.ts';
import { cn } from '@/lib/utils.ts';

const ICON: Record<ReturnType<typeof asKind>, { Icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  material_change: { Icon: TriangleAlert, cls: 'text-risk-amber' },
  recheck: { Icon: RefreshCw, cls: 'text-text-2' },
  recheck_failed: { Icon: CircleX, cls: 'text-risk-red' },
  briefing: { Icon: Sparkles, cls: 'text-accent' },
};

export function AlertCard({ n, now, onOpen, dense }: { n: NotificationRow; now: number; onOpen: (n: NotificationRow) => void; dense?: boolean }) {
  const kind = asKind(n.kind);
  const { Icon, cls } = ICON[kind];
  const unread = isUnread(n);
  const href = notificationHref(n);
  const changes = changesFromPayload(n.payload).slice(0, dense ? 3 : 8);
  return (
    <div className={cn('flex items-start gap-3', dense ? 'rounded-lg px-2.5 py-2.5 hover:bg-bg-1' : 'card px-4 py-3.5', unread && !dense && 'border-l-4 border-l-accent/70')}>
      <span className={cn('inline-flex shrink-0 items-center justify-center rounded-lg bg-bg-2', dense ? 'h-8 w-8' : 'h-9 w-9', cls)}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className={cn('min-w-0 flex-1 leading-snug', dense ? 'text-[13px]' : 'text-[14px]', unread ? 'font-semibold text-text-1' : 'font-medium text-text-2')}>{n.title}</span>
          <span className="shrink-0 t-caption">{relativeTime(n.created_at, now)}</span>
        </div>
        {changes.length > 0 ? (
          <ul className={cn('mt-1.5 space-y-0.5 text-text-2', dense ? 'text-[12px]' : 'text-[13px]')}>
            {changes.map((c, i) => { const l = changeLine(c); return <li key={i}><span className="text-text-1">{l.where}</span>: {l.what.toLowerCase()} <span className="num">{l.from}</span> to <span className="num text-text-1">{l.to}</span>{l.note ? `, ${l.note}` : ''}</li>; })}
          </ul>
        ) : (
          <p className={cn('mt-1 text-text-2 leading-snug', dense ? 'text-[12px] line-clamp-2' : 'text-[13px]')}>{n.body}</p>
        )}
        {href && (
          <div className="mt-2">
            <Link to={href} onClick={() => onOpen(n)} className={cn('inline-flex items-center gap-1 font-medium text-accent hover:underline underline-offset-2', dense ? 'text-[12px]' : 'text-[13px]')}>Open passage <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </div>
        )}
      </div>
    </div>
  );
}
