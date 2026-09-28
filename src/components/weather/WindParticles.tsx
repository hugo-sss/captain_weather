// Windy-style animated particle layer, hand-rolled on canvas (the classic earth.nullschool approach):
// particles advected through the U/V grid, trails faded with destination-in each frame, thin bright
// strokes in --text-1 at low alpha so the colour field underneath stays readable. leaflet-velocity was
// the first choice but cannot be installed offline; this is ~120 lines and has no plugin lifecycle.
import { useEffect, useRef } from 'react';
import type { VectorGrid } from '@/lib/weather-browse/field.ts';
import { bilinear } from '@/lib/weather-browse/field.ts';
import { toGridXY } from '@/lib/weather-browse/grid.ts';
import { isCoarsePointer, projectionTables, useMapCanvas } from './mapCanvas.ts';

const DESKTOP_COUNT = 3000;
const MOBILE_COUNT = 1100;
const MAX_AGE = 90;
const STROKE = 'rgba(230, 237, 247, 0.34)'; // --text-1 at low alpha
const FADE = 'rgba(0, 0, 0, 0.93)';

export function WindParticles({ grid, enabled }: { grid: VectorGrid | null; enabled: boolean }) {
  const gridRef = useRef(grid);
  useEffect(() => { gridRef.current = grid; }, [grid]);
  const state = useRef<{ w: number; h: number; tables: ReturnType<typeof projectionTables> | null; parts: Float32Array; running: boolean; raf: number | null; zoom: number }>({ w: 0, h: 0, tables: null, parts: new Float32Array(0), running: false, raf: null, zoom: 8 });

  // The draw callback only clears and rebuilds the projection; the animation loop paints frames.
  const { map, canvasRef } = useMapCanvas(420, (ctx, { w, h }, m) => {
    ctx.clearRect(0, 0, w, h);
    const s = state.current;
    s.w = w; s.h = h; s.zoom = m.getZoom();
    s.tables = projectionTables(m, w, h, 4);
    const n = isCoarsePointer() ? MOBILE_COUNT : DESKTOP_COUNT;
    if (s.parts.length !== n * 3) s.parts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { s.parts[i * 3] = Math.random() * w; s.parts[i * 3 + 1] = Math.random() * h; s.parts[i * 3 + 2] = Math.random() * MAX_AGE; }
  });

  useEffect(() => {
    const s = state.current;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!enabled || reduced) { const c = canvasRef.current; c?.getContext('2d')?.clearRect(0, 0, c.width, c.height); return; }
    const stop = () => { s.running = false; if (s.raf !== null) { cancelAnimationFrame(s.raf); s.raf = null; } const c = canvasRef.current; c?.getContext('2d')?.clearRect(0, 0, c.width, c.height); };
    const frame = () => {
      s.raf = null;
      if (!s.running) return;
      const c = canvasRef.current, g = gridRef.current, t = s.tables;
      if (c && g && t) {
        const ctx = c.getContext('2d');
        if (ctx) {
          const dpr = c.width / Math.max(1, s.w);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.globalCompositeOperation = 'destination-in';
          ctx.fillStyle = FADE;
          ctx.fillRect(0, 0, s.w, s.h);
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = STROKE;
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          // px per frame per knot; grows with zoom so motion reads at every scale.
          const k = Math.min(0.3, 0.075 * Math.pow(1.45, s.zoom - 8));
          const { spec } = g;
          const p = s.parts;
          for (let i = 0; i < p.length; i += 3) {
            let x = p[i], y = p[i + 1], age = p[i + 2] + 1;
            const col = Math.min(t.cols - 1, Math.max(0, (x / 4) | 0)), row = Math.min(t.rows - 1, Math.max(0, (y / 4) | 0));
            const { x: gx, y: gy } = toGridXY(spec, t.latForRow[row], t.lonForCol[col]);
            const u = bilinear(g.u, spec, gx, gy), v = bilinear(g.v, spec, gx, gy);
            if (age > MAX_AGE || Number.isNaN(u) || x < 0 || y < 0 || x > s.w || y > s.h) {
              x = Math.random() * s.w; y = Math.random() * s.h; age = Number.isNaN(u) ? MAX_AGE * 0.7 : 0;
              p[i] = x; p[i + 1] = y; p[i + 2] = age;
              continue;
            }
            const nx = x + u * k, ny = y - v * k;
            ctx.moveTo(x, y); ctx.lineTo(nx, ny);
            p[i] = nx; p[i + 1] = ny; p[i + 2] = age;
          }
          ctx.stroke();
        }
      }
      s.raf = requestAnimationFrame(frame);
    };
    const start = () => { if (s.running) return; s.running = true; s.raf = requestAnimationFrame(frame); };
    const onVis = () => (document.hidden ? stop() : start());
    map.on('movestart zoomstart', stop);
    map.on('moveend zoomend', start);
    document.addEventListener('visibilitychange', onVis);
    start();
    return () => { stop(); map.off('movestart zoomstart', stop); map.off('moveend zoomend', start); document.removeEventListener('visibilitychange', onVis); };
  }, [enabled, map, canvasRef]);

  return null;
}
