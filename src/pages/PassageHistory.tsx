import { Link } from 'react-router-dom';
import { usePassages } from '@/hooks/usePassage.ts';
import { useVessels } from '@/hooks/useVessels.ts';
import { Button } from '@/components/ui/button.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { fmtUtc } from '@/lib/time.ts';

export default function PassageHistory() {
  const { passages, loading } = usePassages();
  const { vessels } = useVessels();
  const vName = (id: string) => vessels.find((v) => v.id === id)?.name ?? '—';
  return (
    <div className="p-4 max-w-5xl">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-lg font-semibold">Passages</h1>
        <Button asChild size="sm" className="ml-auto"><Link to="/passages/new">New passage</Link></Button>
      </div>
      {vessels.length === 0 && !loading && <p className="text-sm text-text-2 mb-4">Create a <Link className="text-accent" to="/vessels/new">vessel</Link> first: cruise speed and thresholds drive every ETA and risk flag.</p>}
      <table className="w-full text-sm">
        <thead className="border-b border-border"><tr><th className="label text-left py-1.5">Name</th><th className="label text-left">Vessel</th><th className="label text-left">Status</th><th className="label text-left">Planned departure (UTC)</th><th /></tr></thead>
        <tbody>
          {passages.map((p) => (
            <tr key={p.id} className="border-b border-border hover:bg-bg-2/50">
              <td className="py-2"><Link className="text-text-1 hover:text-accent" to={`/passages/${p.id}`}>{p.name}</Link></td>
              <td>{vName(p.vessel_id)}</td>
              <td><Badge className="border-border text-text-2">{p.status}</Badge></td>
              <td className="num">{fmtUtc(p.planned_departure)}</td>
              <td className="text-right"><Link className="text-xs text-text-2 hover:text-accent" to={`/passages/${p.id}/edit`}>Edit</Link></td>
            </tr>
          ))}
          {passages.length === 0 && !loading && <tr><td colSpan={5} className="py-6 text-center text-text-3 text-sm">No passages yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
