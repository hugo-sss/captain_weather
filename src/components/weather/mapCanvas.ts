// A full-viewport canvas glued to the Leaflet overlay pane. It moves with the map while dragging,
// hides during zoom animation, and is resized and redrawn on moveend / zoomend / resize. Redraws
// requested from React are coalesced into one animation frame.
import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

export type CanvasDraw = (ctx: CanvasRenderingContext2D, size: { w: number; h: number; dpr: number }, map: L.Map) => void;

export function useMapCanvas(zIndex: number, draw: CanvasDraw, opts: { maxDpr?: number } = {}) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);
  useEffect(() => { drawRef.current = draw; }, [draw]);
  const frame = useRef<number | null>(null);
  const maxDpr = opts.maxDpr ?? 2;

  const api = useMemo(() => {
    const dpr = () => Math.min(maxDpr, window.devicePixelRatio || 1);
    const reset = () => {
      const c = canvasRef.current;
      if (!c) return;
      const size = map.getSize();
      const d = dpr();
      if (c.width !== Math.round(size.x * d) || c.height !== Math.round(size.y * d)) { c.width = Math.round(size.x * d); c.height = Math.round(size.y * d); }
      c.style.width = `${size.x}px`; c.style.height = `${size.y}px`;
      L.DomUtil.setPosition(c, map.containerPointToLayerPoint([0, 0]));
    };
    const paint = () => {
      frame.current = null;
      const c = canvasRef.current;
      if (!c) return;
      reset();
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const d = dpr();
      ctx.setTransform(d, 0, 0, d, 0, 0);
      drawRef.current(ctx, { w: c.width / d, h: c.height / d, dpr: d }, map);
    };
    const request = () => { if (frame.current === null) frame.current = requestAnimationFrame(paint); };
    return { reset, paint, request };
  }, [map, maxDpr]);

  useEffect(() => {
    const c = document.createElement('canvas');
    c.className = 'leaflet-zoom-hide';
    c.style.position = 'absolute'; c.style.pointerEvents = 'none'; c.style.zIndex = String(zIndex);
    map.getPanes().overlayPane.appendChild(c);
    canvasRef.current = c;
    api.request();
    map.on('moveend zoomend resize viewreset', api.request);
    return () => {
      map.off('moveend zoomend resize viewreset', api.request);
      if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null; }
      c.remove();
      canvasRef.current = null;
    };
  }, [map, api, zIndex]);

  return { map, canvasRef, request: api.request };
}

/** Pixel → lat/lon lookup tables. Web Mercator: longitude depends on x only, latitude on y only. */
export function projectionTables(map: L.Map, w: number, h: number, step: number): { lonForCol: Float64Array; latForRow: Float64Array; cols: number; rows: number } {
  const cols = Math.ceil(w / step), rows = Math.ceil(h / step);
  const lonForCol = new Float64Array(cols), latForRow = new Float64Array(rows);
  for (let i = 0; i < cols; i++) lonForCol[i] = map.containerPointToLatLng([i * step + step / 2, 0]).lng;
  for (let j = 0; j < rows; j++) latForRow[j] = map.containerPointToLatLng([0, j * step + step / 2]).lat;
  return { lonForCol, latForRow, cols, rows };
}

export const isCoarsePointer = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 768);
