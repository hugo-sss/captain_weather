// The one place the app picks its browse source. PREVIEW_MOCK=1 aliases this module to
// src/preview/mockBrowseSource.ts (see vite.config.ts) so the fixtures never reach a production bundle.
import { OpenMeteoSource } from './openMeteo.ts';
import type { BrowseSource } from './types.ts';

let instance: BrowseSource | null = null;
export function getBrowseSource(): BrowseSource {
  return (instance ??= new OpenMeteoSource());
}
