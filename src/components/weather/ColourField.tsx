// Bilinearly interpolated scalar field painted through a ramp LUT at ~0.55 opacity, so the Esri dark
// base stays legible. Painted at reduced resolution and upscaled with smoothing; redrawn only on
// map moves, time changes, or new data.
import { useCallback, useEffect, useMemo } from 'react';
import { bilinear, type ScalarGrid } from '@/lib/weather-browse/field.ts';
import { toGridXY } from '@/lib/weather-browse/grid.ts';
import { buildLut, RAMPS, rampCss, type FieldKind } from '@/lib/weather-browse/ramps.ts';
import { isCoarsePointer, projectionTables, useMapCanvas, type CanvasDraw } from './mapCanvas.ts';
import { cn } from '@/lib/utils.ts';

const OPACITY = 0.55;

export function ColourField({ grid, kind }: { grid: ScalarGrid | null; kind: FieldKind }) {
  const lut = useMemo(() => buildLut(RAMPS[kind]), [kind]);
  const draw = useCallback<CanvasDraw>((ctx, { w, h }, map) => {
    ctx.clearRect(0, 0, w, h);
    if (!grid) return;
    const step = isCoarsePointer() ? 4 : 3;
    const { lonForCol, latForRow, cols, rows } = projectionTables(map, w, h, step);
    const small = document.createElement('canvas');
    small.width = cols; small.height = rows;
    const sctx = small.getContext('2d');
    if (!sctx) return;
    const img = sctx.createImageData(cols, rows);
    const data = img.data;
    const { spec, values } = grid;
    const { lut: table, min, max } = lut;
    const scale = 255 / (max - min);
    for (let j = 0; j < rows; j++) {
      const lat = latForRow[j];
      const gy = (lat - spec.lat0) / spec.dLat;
      if (gy < 0 || gy > spec.ny - 1) continue;
      for (let i = 0; i < cols; i++) {
        const { x: gx } = toGridXY(spec, lat, lonForCol[i]);
        const v = bilinear(values, spec, gx, gy);
        if (Number.isNaN(v)) continue;
        const k = Math.max(0, Math.min(255, Math.round((v - min) * scale))) * 4;
        const o = (j * cols + i) * 4;
        data[o] = table[k]; data[o + 1] = table[k + 1]; data[o + 2] = table[k + 2]; data[o + 3] = table[k + 3];
      }
    }
    sctx.putImageData(img, 0, 0);
    ctx.globalAlpha = OPACITY;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, cols, rows, 0, 0, w, h);
    ctx.globalAlpha = 1;
  }, [grid, lut]);
  const { request } = useMapCanvas(410, draw);
  useEffect(() => { request(); }, [grid, lut, request]);
  return null;
}

/** Compact legend bar (PRD §9.1 Windy borrow): gradient with unit ticks. */
export function FieldLegend({ kind, className }: { kind: FieldKind; className?: string }) {
  const ramp = RAMPS[kind];
  const min = ramp.stops[0][0], max = ramp.stops[ramp.stops.length - 1][0];
  const label: Record<FieldKind, string> = { wind: 'Wind', gusts: 'Gusts', waves: 'Wave height', swell: 'Swell height', rain: 'Precipitation', pressure: 'Pressure MSL' };
  return (
    <div className={cn('rounded-md border border-border bg-bg-1/95 backdrop-blur-sm px-2.5 py-1.5 w-[220px] sm:w-[260px] shadow-[0_4px_16px_rgba(0,0,0,0.35)]', className)} role="img" aria-label={`${label[kind]} legend in ${ramp.unit}`}>
      <div className="flex items-baseline justify-between"><span className="label">{label[kind]}</span><span className="text-[10px] text-text-3">{ramp.unit}</span></div>
      <div className="mt-1 h-2 rounded-sm" style={{ background: rampCss(ramp), opacity: 0.9 }} />
      <div className="relative h-3.5 mt-0.5">
        {ramp.ticks.map((t) => <span key={t} className="num absolute -translate-x-1/2 text-[10px] text-text-2 leading-none" style={{ left: `${((t - min) / (max - min)) * 100}%` }}>{ramp.fmt(t)}{t === max && kind !== 'pressure' ? '+' : ''}</span>)}
      </div>
    </div>
  );
}
