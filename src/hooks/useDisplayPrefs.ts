import { useCallback, useEffect, useState } from 'react';
import type { DisplayPrefs } from '@/types/domain.ts';

const KEY = 'cpt.displayPrefs.v1';
const DEFAULTS: DisplayPrefs = { narrative_emphasis: 0, use_current: false, show_openseamap: true, show_noaa_enc: false, local_utc_offset_min: null };

function read(): DisplayPrefs {
  try { const raw = localStorage.getItem(KEY); return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS; } catch { return DEFAULTS; }
}

const listeners = new Set<(p: DisplayPrefs) => void>();
let current: DisplayPrefs | null = null;

/** Display preferences change ordering and emphasis only. They never gate data access. Shared across components in the tab. */
export function useDisplayPrefs() {
  const [prefs, setPrefs] = useState<DisplayPrefs>(() => current ?? (current = read()));
  useEffect(() => { listeners.add(setPrefs); return () => { listeners.delete(setPrefs); }; }, []);
  const update = useCallback((patch: Partial<DisplayPrefs>) => {
    const next = { ...(current ?? read()), ...patch };
    current = next;
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
    for (const l of listeners) l(next);
  }, []);
  return { prefs, update };
}
