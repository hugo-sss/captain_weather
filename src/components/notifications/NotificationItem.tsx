// One inbox row: kind icon, title, body, relative time. Shared by the bell dropdown and /notifications.
import { Link } from 'react-router-dom';
import { CircleX, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
import type { NotificationRow } from '@/types/domain.ts';
import { asKind, isUnread, KIND_LABEL, notificationHref, relativeTime } from '@/lib/notifications.ts';
import { cn } from '@/lib/utils.ts';

const ICON: Record<ReturnType<typeof asKind>, { Icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  material_change: { Icon: TriangleAlert, cls: 'text-risk-amber' },
  recheck: { Icon: RefreshCw, cls: 'text-text-2' },
  recheck_failed: { Icon: CircleX, cls: 'text-risk-red' },
  briefing: { Icon: Sparkles, cls: 'text-accent' },
};

export function NotificationItem({ n, now, onOpen, dense }: { n: NotificationRow; now: number; onOpen: (n: NotificationRow) => void; dense?: boolean }) {
  const kind = asKind(n.kind);
  const { Icon, cls } = ICON[kind];
  const unread = isUnread(n);
  const href = notificationHref(n);
  const inner = (
    <>
      <span className={cn('inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-bg-2', dense ? 'h-7 w-7' : 'h-8 w-8', cls)}><Icon className="h-3.5 w-3.5" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn('truncate', dense ? 'text-[13px]' : 'text-sm', unread ? 'font-semibold text-text-1' : 'text-text-2')}>{n.title}</span>
          {unread && <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" aria-label="unread" />}
          <span className="ml-auto num text-[10.5px] text-text-3 shrink-0">{relativeTime(n.created_at, now)}</span>
        </span>
        <span className={cn('block text-text-3 mt-0.5', dense ? 'text-[11px] line-clamp-2' : 'text-xs')}>{n.body}</span>
        <span className="block text-[10px] uppercase tracking-[0.06em] text-text-3/80 mt-1">{KIND_LABEL[kind]}</span>
      </span>
    </>
  );
  const cls2 = cn('flex items-start gap-2.5 w-full text-left rounded-md px-2 py-2 transition-colors hover:bg-bg-2', unread && 'bg-bg-2/40');
  return href
    ? <Link to={href} onClick={() => onOpen(n)} className={cls2}>{inner}</Link>
    : <button type="button" onClick={() => onOpen(n)} className={cls2}>{inner}</button>;
}
