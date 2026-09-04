import { useCallback, useEffect, useState } from 'react';
import type { DisplayPrefs } from '@/types/domain.ts';

const KEY = 'cpt.displayPrefs.v1';
const DEFAULTS: DisplayPrefs = { narrative_emphasis: 0, use_current: false, show_openseamap: true, show_noaa_enc: false, local_utc_offset_min: null };

function read(): DisplayPrefs {
  try { const raw = localStorage.getItem(KEY); return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS; } catch { return DEFAULTS; }
}

/** Display preferences change ordering and emphasis only. They never gate data access. */
export function useDisplayPrefs() {
  const [prefs, setPrefs] = useState<DisplayPrefs>(read);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignore */ } }, [prefs]);
  const update = useCallback((patch: Partial<DisplayPrefs>) => setPrefs((p) => ({ ...p, ...patch })), []);
  return { prefs, update };
}
