/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// PREVIEW_MOCK=1 swaps the Supabase client for the in-memory fixture client so every screen renders
// with realistic data and no network. Dev-time only: the alias is never applied to a normal build.
const previewMock = process.env.PREVIEW_MOCK === '1';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      ...(previewMock ? [{ find: /^@\/lib\/supabase\.ts$/, replacement: path.resolve(__dirname, 'src/preview/mockSupabase.ts') }] : []),
      { find: '@', replacement: path.resolve(__dirname, 'src') },
    ],
  },
  server: { port: 5173 },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    environment: 'node',
  },
});
