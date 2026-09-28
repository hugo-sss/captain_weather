// Fixed banner while a page is rendering the IndexedDB bundle instead of live rows. Non-dismissible.
import { WifiOff } from 'lucide-react';
import { useOffline } from '@/hooks/useOffline.ts';
import { fmtUtc } from '@/lib/time.ts';

export function OfflineBanner() {
  const { offline, savedAt } = useOffline();
  if (!offline) return null;
  return (
    <div role="status" aria-live="polite" className="sticky top-0 z-[1050] bg-bg-2 border-b border-risk-amber/40 text-text-1 text-[12px] leading-snug px-3 py-1.5 flex items-center gap-2 shrink-0">
      <WifiOff className="h-3.5 w-3.5 text-risk-amber shrink-0" />
      <span><span className="font-semibold">Offline.</span> Showing data from <span className="num">{savedAt ? fmtUtc(savedAt) : 'the last visit'}</span>. Numbers may have moved since; nothing here is live.</span>
    </div>
  );
}
