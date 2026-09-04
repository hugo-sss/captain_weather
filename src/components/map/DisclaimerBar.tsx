// PRD Feature 7: persistent, non-dismissible on any screen with a chart overlay. No close control by design.
import { TriangleAlert } from 'lucide-react';
export function DisclaimerBar() {
  return (
    <div role="note" aria-live="polite" className="bg-risk-amber/10 border-y border-risk-amber/30 text-risk-amber text-[12px] leading-snug px-3 py-1.5 flex items-center gap-2 shrink-0 select-none">
      <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
      <span><span className="font-semibold">Supplementary planning aid.</span> Not a certified ECDIS or a substitute for official charts.</span>
    </div>
  );
}
