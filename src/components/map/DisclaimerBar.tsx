// PRD Feature 7: persistent, non-dismissible on any screen with a chart overlay.
import { TriangleAlert } from 'lucide-react';
export function DisclaimerBar() {
  return (
    <div role="note" aria-live="polite" className="bg-risk-amber/10 border-y border-risk-amber/30 text-risk-amber text-xs px-3 py-1.5 flex items-center gap-2 shrink-0 select-none">
      <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
      <span>Supplementary planning aid. Not a certified ECDIS or a substitute for official charts.</span>
    </div>
  );
}
