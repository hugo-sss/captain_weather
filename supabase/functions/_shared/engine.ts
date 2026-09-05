// Re-export of the passage engine so edge functions and the UI share one
// implementation. Deployed bundles inline this (scripts/bundle-functions.mjs).
export * from '../../../src/lib/passage-engine/engine.ts';
export * from '../../../src/lib/passage-engine/geo.ts';
