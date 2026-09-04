import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase.ts';
import type { VesselRow } from '@/types/domain.ts';

export function useVessels() {
  const [vessels, setVessels] = useState<VesselRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('vessels').select('*').order('created_at');
    if (error) setError(error.message); else setVessels(data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void Promise.resolve().then(reload); }, [reload]);
  return { vessels, loading, error, reload };
}
