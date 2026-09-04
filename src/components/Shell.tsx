import { Link, NavLink, Outlet } from 'react-router-dom';
import { Anchor, LogOut, Route, Ship } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.ts';
import { AttributionFooter } from '@/components/AttributionFooter.tsx';
import { DisplayPrefsControl } from '@/components/DisplayPrefsControl.tsx';
import { cn } from '@/lib/utils.ts';

export function Shell() {
  const { user, signOut } = useAuth();
  const nav = ({ isActive }: { isActive: boolean }) =>
    cn('inline-flex h-8 items-center gap-1.5 px-2.5 rounded-md text-[13px] font-medium transition-colors', isActive ? 'bg-bg-2 text-text-1 shadow-[inset_0_-2px_0_#2DD4BF]' : 'text-text-2 hover:text-text-1 hover:bg-bg-2/60');
  return (
    <div className="min-h-full flex flex-col">
      <header className="h-12 border-b border-border bg-bg-1 flex items-center px-3 sm:px-4 gap-1.5 shrink-0">
        <Link to="/" className="flex items-center gap-2 font-semibold text-[14px] mr-2 sm:mr-4 shrink-0">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent/12 border border-accent/30 text-accent"><Anchor className="h-4 w-4" /></span>
          <span className="hidden sm:inline">Captain Passage Tool</span><span className="sm:hidden">Passage Tool</span>
        </Link>
        <NavLink to="/passages" className={nav}><Route className="h-3.5 w-3.5" /> Passages</NavLink>
        <NavLink to="/vessels" className={nav}><Ship className="h-3.5 w-3.5" /> Vessels</NavLink>
        <div className="ml-auto flex items-center gap-3 text-xs text-text-3">
          <DisplayPrefsControl />
          <span className="hidden lg:inline num text-[11px]">{user?.email}</span>
          <button onClick={() => void signOut()} className="inline-flex h-8 items-center gap-1 rounded-md px-2 hover:bg-bg-2 hover:text-text-1 transition-colors" aria-label="Sign out"><LogOut className="h-3.5 w-3.5" /><span className="hidden sm:inline">Sign out</span></button>
        </div>
      </header>
      <main className="flex-1 min-h-0 flex flex-col">
        <Outlet />
      </main>
      <AttributionFooter />
    </div>
  );
}
