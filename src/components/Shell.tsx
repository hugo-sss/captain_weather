import { Link, NavLink, Outlet } from 'react-router-dom';
import { Anchor, LogOut, Ship } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.ts';
import { AttributionFooter } from '@/components/AttributionFooter.tsx';
import { DisplayPrefsControl } from '@/components/DisplayPrefsControl.tsx';
import { cn } from '@/lib/utils.ts';

export function Shell() {
  const { user, signOut } = useAuth();
  const nav = ({ isActive }: { isActive: boolean }) => cn('px-3 py-1.5 rounded-md text-sm', isActive ? 'bg-bg-2 text-text-1' : 'text-text-2 hover:text-text-1');
  return (
    <div className="min-h-full flex flex-col">
      <header className="h-12 border-b border-border bg-bg-1 flex items-center px-4 gap-2 shrink-0">
        <Link to="/" className="flex items-center gap-2 font-semibold mr-4"><Anchor className="h-4 w-4 text-accent" /> Captain Passage Tool</Link>
        <NavLink to="/passages" className={nav}>Passages</NavLink>
        <NavLink to="/vessels" className={nav}><span className="inline-flex items-center gap-1"><Ship className="h-3.5 w-3.5" /> Vessels</span></NavLink>
        <div className="ml-auto flex items-center gap-3 text-xs text-text-3">
          <DisplayPrefsControl />
          <span className="hidden sm:inline">{user?.email}</span>
          <button onClick={() => void signOut()} className="inline-flex items-center gap-1 hover:text-text-1"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
        </div>
      </header>
      <main className="flex-1 min-h-0 flex flex-col">
        <Outlet />
      </main>
      <AttributionFooter />
    </div>
  );
}
