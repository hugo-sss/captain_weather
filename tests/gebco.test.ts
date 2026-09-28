import { describe, expect, it } from 'vitest';
import { gebcoDepthFromElevation, gebcoUrl, parseGebcoResponse, ukcBasisText, GEBCO_CHIP_LABEL } from '../src/lib/gebco.ts';

describe('GEBCO depth conversion', () => {
  it('negative elevation is depth below sea level, rounded to 0.1 m', () => {
    expect(gebcoDepthFromElevation(-14.26)).toBe(14.3);
    expect(gebcoDepthFromElevation(-0.04)).toBe(0);
  });
  it('land (elevation >= 0) and missing values give no depth', () => {
    expect(gebcoDepthFromElevation(12)).toBeNull();
    expect(gebcoDepthFromElevation(0)).toBeNull();
    expect(gebcoDepthFromElevation(null)).toBeNull();
    expect(gebcoDepthFromElevation(Number.NaN)).toBeNull();
  });
  it('parses the OpenTopoData body into a suggestion, or null with no usable result', () => {
    expect(parseGebcoResponse({ results: [{ elevation: -22.9 }] }, 7.5, 99.0)).toEqual({ depthM: 22.9, elevationM: -22.9, lat: 7.5, lon: 99.0 });
    expect(parseGebcoResponse({ results: [{ elevation: 5 }] }, 7.5, 99.0)).toBeNull();
    expect(parseGebcoResponse({ results: [] }, 7.5, 99.0)).toBeNull();
  });
  it('builds the keyless gebco2020 URL and spells out provenance in the UKC basis', () => {
    expect(gebcoUrl(7.51423, 99.07201)).toBe('https://api.opentopodata.org/v1/gebco2020?locations=7.51423,99.07201');
    expect(ukcBasisText('charted+tide+swell', 'gebco')).toBe(`charted+tide+swell (${GEBCO_CHIP_LABEL})`);
    expect(ukcBasisText('charted+tide', 'user')).toBe('charted+tide');
    expect(ukcBasisText(null, 'gebco')).toBeUndefined();
  });
});
