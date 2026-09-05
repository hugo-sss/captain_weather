// Shell header bell: unread count, the latest 10 in a dropdown (a bottom sheet on phones), mark all read,
// link to the full /notifications page. Polling lives in useNotifications and is shared.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications.ts';
import { useIsMobile } from '@/hooks/useMediaQuery.ts';
import { useNow } from '@/hooks/useNow.ts';
import { latest } from '@/lib/notifications.ts';
import { NotificationItem } from './NotificationItem.tsx';
import { cn } from '@/lib/utils.ts';

export function NotificationBell() {
  const { notifications, unread, loaded, error, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const now = useNow(30_000);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const top = latest(notifications, 10);
  const list = (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <span className="text-[13px] font-semibold">Alerts</span>
        <span className="num text-[11px] text-text-3">{unread} unread</span>
        <button type="button" onClick={() => void markAllRead()} disabled={unread === 0} className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] text-text-2 hover:bg-bg-2 hover:text-text-1 disabled:opacity-40"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button>
        {mobile && <button type="button" onClick={() => setOpen(false)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-3 hover:bg-bg-2 hover:text-text-1" aria-label="Close"><X className="h-4 w-4" /></button>}
      </div>
      <div className={cn('overflow-y-auto p-1', mobile ? 'max-h-[60vh]' : 'max-h-[420px]')}>
        {error && <p className="px-2 py-2 text-xs text-risk-red">{error}</p>}
        {!error && loaded && top.length === 0 && <p className="px-2 py-4 text-xs text-text-3 text-center">No alerts yet. Re-checks that find material changes land here.</p>}
        {top.map((n) => <NotificationItem key={n.id} n={n} now={now} dense onOpen={(x) => { void markRead([x.id]); setOpen(false); }} />)}
      </div>
      <div className="border-t border-border px-3 py-1.5 text-[11px] flex items-center justify-between"><span className="text-text-3">latest {top.length} of {notifications.length}</span><Link to="/notifications" onClick={() => setOpen(false)} className="text-accent hover:underline underline-offset-2">All notifications</Link></div>
    </>
  );
  return (
    <div ref={wrap} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label={`Alerts, ${unread} unread`} aria-expanded={open} aria-haspopup="dialog" className={cn('relative inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-bg-2 hover:text-text-1', open ? 'bg-bg-2 text-text-1' : 'text-text-2')}>
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-bg-0 num text-[10px] font-semibold leading-4 text-center" aria-hidden>{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (mobile
        ? <div role="dialog" aria-label="Alerts" className="fixed inset-x-0 bottom-0 z-[1200] rounded-t-lg border-t border-border bg-bg-1 shadow-[0_-12px_40px_rgba(0,0,0,0.5)]"><div className="flex justify-center pt-2"><span className="h-1 w-10 rounded-full bg-border" aria-hidden /></div>{list}</div>
        : <div role="dialog" aria-label="Alerts" className="fixed right-3 top-[52px] z-[1200] w-[360px] rounded-lg border border-border bg-bg-1 shadow-[0_12px_40px_rgba(0,0,0,0.55)] text-sm">{list}</div>)}
    </div>
  );
}
