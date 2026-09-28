// Network edge for the GEBCO suggestion. Swapped for a fixture under PREVIEW_MOCK (vite.config.ts alias).
import { gebcoUrl, parseGebcoResponse, type GebcoResponse, type GebcoSuggestion } from './gebco.ts';

let lastCall = 0;
const MIN_GAP_MS = 1100; // OpenTopoData public limit: 1 request per second

/** One keyless request, paced to 1/s. Resolves null on land or when the grid has no value. Throws on network/API errors. */
export async function suggestGebcoDepth(lat: number, lon: number, signal?: AbortSignal): Promise<GebcoSuggestion | null> {
  const wait = lastCall + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const res = await fetch(gebcoUrl(lat, lon), { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`GEBCO lookup failed (${res.status})`);
  const body = (await res.json()) as GebcoResponse;
  if (body.status && body.status !== 'OK') throw new Error(body.error ?? `GEBCO lookup failed (${body.status})`);
  return parseGebcoResponse(body, lat, lon);
}
