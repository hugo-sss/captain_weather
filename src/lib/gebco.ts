// GEBCO 2020 grid depth via OpenTopoData (keyless, 1 request/s). A grid value is a suggestion the user
// must accept explicitly; it is saved with charted_depth_source = 'gebco' and never presented as charted.
export const GEBCO_ENDPOINT = 'https://api.opentopodata.org/v1/gebco2020';
export const GEBCO_CHIP_LABEL = 'GEBCO grid, verify on chart';

export type GebcoResponse = { status?: string; results?: { elevation: number | null; location?: { lat: number; lng: number } }[]; error?: string };
export type GebcoSuggestion = { depthM: number; elevationM: number; lat: number; lon: number };

/** Elevation is metres above sea level; negative means below, so depth = -elevation. Land (>= 0) gives no depth. */
export function gebcoDepthFromElevation(elevation: number | null | undefined): number | null {
  if (elevation === null || elevation === undefined || !Number.isFinite(elevation)) return null;
  if (elevation >= 0) return null;
  return Math.round(-elevation * 10) / 10;
}

export function parseGebcoResponse(body: GebcoResponse, lat: number, lon: number): GebcoSuggestion | null {
  const r = body.results?.[0];
  if (!r) return null;
  const depthM = gebcoDepthFromElevation(r.elevation);
  return depthM === null ? null : { depthM, elevationM: r.elevation as number, lat, lon };
}

export const gebcoUrl = (lat: number, lon: number) => `${GEBCO_ENDPOINT}?locations=${lat.toFixed(5)},${lon.toFixed(5)}`;

/** Depth-source wording for UKC basis text and chips. */
export function depthSourceNote(source: string | null | undefined): string | null {
  return source === 'gebco' ? GEBCO_CHIP_LABEL : null;
}

/** UKC basis text, with the depth provenance spelled out when the depth is a GEBCO grid value. */
export function ukcBasisText(basis: string | null | undefined, depthSource: string | null | undefined): string | undefined {
  if (!basis) return undefined;
  const note = depthSourceNote(depthSource);
  return note ? `${basis} (${note})` : basis;
}
