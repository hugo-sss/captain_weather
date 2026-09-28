// Header bell: unread count, the latest alerts in a dropdown (a bottom sheet on phones), mark all read,
// link to the full /alerts page. Polling lives in useNotifications and is shared.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications.ts';
import { useIsMobile } from '@/hooks/useMediaQuery.ts';
import { useNow } from '@/hooks/useNow.ts';
import { latest } from '@/lib/notifications.ts';
import { AlertCard } from './AlertCard.tsx';
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
  const top = latest(notifications, 8);
  const list = (
    <>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-soft">
        <span className="t-card">Alerts</span>
        <span className="t-caption">{unread === 0 ? 'all read' : `${unread} unread`}</span>
        <button type="button" onClick={() => void markAllRead()} disabled={unread === 0} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-text-2 hover:bg-bg-2 hover:text-text-1 disabled:opacity-40"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button>
        {mobile && <button type="button" onClick={() => setOpen(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-3 hover:bg-bg-2 hover:text-text-1" aria-label="Close"><X className="h-4 w-4" /></button>}
      </div>
      <div className={cn('overflow-y-auto p-1.5', mobile ? 'max-h-[60vh]' : 'max-h-[440px]')}>
        {error && <p className="px-3 py-2 text-[12px] text-risk-red">{error}</p>}
        {!error && loaded && top.length === 0 && <p className="px-3 py-6 t-caption text-center">No alerts yet. Checks that find changes land here.</p>}
        {top.map((n) => <AlertCard key={n.id} n={n} now={now} dense onOpen={(x) => { void markRead([x.id]); setOpen(false); }} />)}
      </div>
      <div className="border-t border-border-soft px-4 py-2.5 text-[12px] flex items-center justify-between"><span className="text-text-3">Latest {top.length} of {notifications.length}</span><Link to="/alerts" onClick={() => setOpen(false)} className="font-medium text-accent hover:underline underline-offset-2">All alerts</Link></div>
    </>
  );
  return (
    <div ref={wrap} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label={`Alerts, ${unread} unread`} aria-expanded={open} aria-haspopup="dialog" className={cn('relative inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-bg-2 hover:text-text-1', open ? 'bg-bg-2 text-text-1' : 'text-text-2')}>
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-bg-0 num text-[10px] font-semibold leading-4 text-center" aria-hidden>{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (mobile
        ? <div role="dialog" aria-label="Alerts" className="fixed inset-x-0 bottom-0 z-[1200] rounded-t-2xl border-t border-border-soft bg-bg-1 shadow-pop"><div className="flex justify-center pt-2"><span className="h-1 w-10 rounded-full bg-border" aria-hidden /></div>{list}</div>
        : <div role="dialog" aria-label="Alerts" className="fixed right-4 top-[60px] z-[1200] w-[400px] rounded-xl border border-border-soft bg-bg-2/95 backdrop-blur-sm shadow-pop text-[14px]">{list}</div>)}
    </div>
  );
}
