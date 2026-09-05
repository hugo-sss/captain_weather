// Dev-only stand-in for '@/lib/gebco-source.ts' (PREVIEW_MOCK=1 alias in vite.config.ts): the OpenTopoData
// GEBCO response from the fixture, with a short delay so the button's busy state shows.
import { parseGebcoResponse, type GebcoSuggestion } from '@/lib/gebco.ts';
import { gebcoFixture } from './fixtures.ts';

export async function suggestGebcoDepth(lat: number, lon: number): Promise<GebcoSuggestion | null> {
  await new Promise((r) => setTimeout(r, 400));
  return parseGebcoResponse(gebcoFixture(lat, lon), lat, lon);
}
