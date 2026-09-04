// Shared recharts styling so every chart on the page reads as one system.
export const CHART_GRID = '#1B2740';
export const CHART_AXIS = '#66748F';
export const CHART_TICK = { fontSize: 10, fontFamily: '"JetBrains Mono", ui-monospace, monospace', fill: '#66748F' } as const;
export const CHART_TOOLTIP = { contentStyle: { background: '#182338', border: '1px solid #23304A', borderRadius: 6, fontSize: 11, fontFamily: '"JetBrains Mono", ui-monospace, monospace', boxShadow: '0 8px 24px rgba(0,0,0,0.45)', padding: '6px 10px' }, labelStyle: { color: '#9AA8C0', marginBottom: 4 }, itemStyle: { padding: 0 } } as const;
export const fmtTick = (t: number) => { const d = new Date(t); return `${d.getUTCDate()}/${d.getUTCMonth() + 1} ${String(d.getUTCHours()).padStart(2, '0')}Z`; };
