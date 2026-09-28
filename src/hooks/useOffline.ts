// Shared offline state: any hook that falls back to the IndexedDB bundle reports it here, and the page
// shows one fixed banner. Cleared when a live read succeeds again.
import { useSyncExternalStore } from 'react';

export type OfflineState = { offline: boolean; savedAt: string | null };
let state: OfflineState = { offline: false, savedAt: null };
const listeners = new Set<(s: OfflineState) => void>();
const emit = () => { for (const l of listeners) l(state); };

export function reportOffline(savedAt: string | null) {
  const next = { offline: true, savedAt: savedAt ?? state.savedAt };
  if (next.offline === state.offline && next.savedAt === state.savedAt) return;
  state = next; emit();
}
export function reportOnline() {
  if (!state.offline) return;
  state = { offline: false, savedAt: null }; emit();
}

const subscribe = (l: (s: OfflineState) => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => state;

export function useOffline(): OfflineState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
