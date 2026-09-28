// App frame: a quiet top bar (brand, three items, bell, avatar menu) and, on phones, a bottom tab bar.
// Display preferences live on the Settings page; nothing in the header changes how data is shown.
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Anchor, Bell, CloudSun, LogOut, Route, Settings, Ship } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.ts';
import { useNotifications } from '@/hooks/useNotifications.ts';
import { AttributionFooter } from '@/components/AttributionFooter.tsx';
import { NotificationBell } from '@/components/notifications/NotificationBell.tsx';
import { DropdownMenu } from '@/components/ui/dropdown-menu.tsx';
import { cn } from '@/lib/utils.ts';

const TOP_NAV = [
  { to: '/', label: 'Weather', icon: CloudSun, end: true },
  { to: '/passages', label: 'Passages', icon: Route, end: false },
  { to: '/vessels', label: 'Vessel', icon: Ship, end: false },
] as const;

export function Shell() {
  const { user, signOut } = useAuth();
  const { unread } = useNotifications();
  // The weather map is full-bleed: pin the shell to the viewport so the map fills it; other pages scroll as before.
  const fullBleed = useLocation().pathname === '/';
  const nav = ({ isActive }: { isActive: boolean }) =>
    cn('inline-flex h-9 items-center gap-2 px-3 rounded-lg text-[14px] font-medium transition-colors', isActive ? 'bg-bg-2 text-text-1' : 'text-text-2 hover:text-text-1 hover:bg-bg-2/60');
  const initial = (user?.email ?? '?').slice(0, 1).toUpperCase();
  return (
    <div className={cn('flex flex-col', fullBleed ? 'h-full' : 'min-h-full')}>
      <header className="h-14 border-b border-border-soft bg-bg-1 flex items-center px-4 md:px-6 gap-2 shrink-0">
        <Link to="/" className="flex items-center gap-2.5 font-semibold text-[15px] mr-2 md:mr-6 shrink-0 min-w-0">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/12 text-accent"><Anchor className="h-4 w-4" /></span>
          <span className="truncate">Captain Passage Tool</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1" aria-label="Main">
          {TOP_NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={nav}><n.icon className="h-4 w-4" />{n.label}</NavLink>)}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <NotificationBell />
          <DropdownMenu label="Account" align="end" items={[
            { kind: 'heading', label: user?.email ?? 'Signed in' },
            { label: 'Settings', icon: Settings, href: '/settings', hint: 'Local time, detail level and map overlays.' },
            { kind: 'divider' },
            { label: 'Sign out', icon: LogOut, onSelect: () => void signOut() },
          ]} trigger={
            <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-bg-2" aria-label="Account menu">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-bg-2 text-[12px] font-semibold text-text-1">{initial}</span>
            </button>
          } />
        </div>
      </header>
      <main className={cn('flex-1 min-h-0 flex flex-col', fullBleed && 'overflow-hidden')}>
        <Outlet />
      </main>
      <AttributionFooter />
      <nav className="md:hidden sticky bottom-0 z-[1000] shrink-0 border-t border-border-soft bg-bg-1/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]" aria-label="Main">
        <div className="grid grid-cols-4 h-[var(--tabbar-h)]">
          {[...TOP_NAV, { to: '/alerts', label: 'Alerts', icon: Bell, end: false }].map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors', isActive ? 'text-accent' : 'text-text-2')}>
              <n.icon className="h-5 w-5" />
              {n.label}
              {n.to === '/alerts' && unread > 0 && <span className="absolute top-2 left-1/2 ml-1.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-bg-0 num text-[10px] font-semibold leading-4 text-center" aria-hidden>{unread > 99 ? '99+' : unread}</span>}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
