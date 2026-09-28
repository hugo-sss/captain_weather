// Dev-only stand-in for '@/lib/weather-browse/source.ts' (PREVIEW_MOCK=1 alias in vite.config.ts).
import { FixtureBrowseSource } from '@/lib/weather-browse/fixtures.ts';
import type { BrowseSource } from '@/lib/weather-browse/types.ts';

let instance: BrowseSource | null = null;
export function getBrowseSource(): BrowseSource {
  return (instance ??= new FixtureBrowseSource());
}
