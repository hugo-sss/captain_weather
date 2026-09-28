import { useCallback, useEffect, useRef, useState } from 'react';
import { cachedPointTide, fetchPointTide, type PointTideOk } from '@/lib/point-tide.ts';

/**
 * "Tide here" for a lat/lon. Nothing is fetched until `load()` is called (the function costs credits);
 * moving to a different cell clears the result but keeps the session cache.
 */
export function usePointTide(lat: number, lon: number, days = 3) {
  const [data, setData] = useState<PointTideOk | null>(() => cachedPointTide(lat, lon, days));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const keyRef = useRef(key);
  useEffect(() => {
    if (keyRef.current === key) return;
    keyRef.current = key;
    setData(cachedPointTide(lat, lon, days)); setError(null); setLoading(false);
  }, [key, lat, lon, days]);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const k = key;
    try { const r = await fetchPointTide({ lat, lon, days }); if (keyRef.current === k) setData(r); }
    catch (e) { if (keyRef.current === k) setError((e as Error).message); }
    finally { if (keyRef.current === k) setLoading(false); }
  }, [lat, lon, days, key]);
  return { data, loading, error, load };
}
